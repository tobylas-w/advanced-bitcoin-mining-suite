#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const logger = require('./logger');

class BackupManager {
    constructor() {
        this.backupDir = path.join(__dirname, 'backups');
        this.configFiles = [
            'mining-intensity.json',
            'mining-config.json',
            'remote-clients.json'
        ];
        this.logFiles = [
            'logs/info.log',
            'logs/error.log'
        ];
        this.maxBackups = 30; // Keep 30 days of backups
        this.backupInterval = 24 * 60 * 60 * 1000; // 24 hours
        
        this.ensureBackupDirectory();
        this.startAutoBackup();
    }

    ensureBackupDirectory() {
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
            logger.info('Created backup directory', { path: this.backupDir });
        }
    }

    async createBackup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(this.backupDir, `backup-${timestamp}`);
            
            // Create backup directory
            fs.mkdirSync(backupPath, { recursive: true });
            
            const backupManifest = {
                timestamp: new Date().toISOString(),
                version: '1.0.0',
                files: [],
                stats: {}
            };

            // Backup configuration files
            for (const configFile of this.configFiles) {
                const sourcePath = path.join(__dirname, configFile);
                if (fs.existsSync(sourcePath)) {
                    const destPath = path.join(backupPath, configFile);
                    const destDir = path.dirname(destPath);
                    
                    if (!fs.existsSync(destDir)) {
                        fs.mkdirSync(destDir, { recursive: true });
                    }
                    
                    fs.copyFileSync(sourcePath, destPath);
                    backupManifest.files.push({
                        file: configFile,
                        size: fs.statSync(sourcePath).size,
                        backed_up: true
                    });
                    logger.debug('Backed up file', { file: configFile });
                }
            }

            // Backup recent log files (last 7 days)
            for (const logFile of this.logFiles) {
                const sourcePath = path.join(__dirname, logFile);
                if (fs.existsSync(sourcePath)) {
                    const stats = fs.statSync(sourcePath);
                    const daysSinceModified = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
                    
                    if (daysSinceModified <= 7) {
                        const destPath = path.join(backupPath, logFile);
                        const destDir = path.dirname(destPath);
                        
                        if (!fs.existsSync(destDir)) {
                            fs.mkdirSync(destDir, { recursive: true });
                        }
                        
                        fs.copyFileSync(sourcePath, destPath);
                        backupManifest.files.push({
                            file: logFile,
                            size: stats.size,
                            backed_up: true
                        });
                        logger.debug('Backed up log file', { file: logFile });
                    }
                }
            }

            // Create backup manifest
            const manifestPath = path.join(backupPath, 'backup-manifest.json');
            fs.writeFileSync(manifestPath, JSON.stringify(backupManifest, null, 2));

            // Compress backup if tar is available
            try {
                await this.compressBackup(backupPath);
                // Remove uncompressed directory after successful compression
                this.removeDirectory(backupPath);
            } catch (error) {
                logger.warn('Could not compress backup, keeping uncompressed', { error: error.message });
            }

            logger.info('Backup created successfully', { 
                path: backupPath,
                files: backupManifest.files.length
            });

            // Clean up old backups
            this.cleanupOldBackups();

            return {
                success: true,
                path: backupPath,
                files: backupManifest.files.length,
                timestamp: backupManifest.timestamp
            };

        } catch (error) {
            logger.error('Failed to create backup', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }

    async compressBackup(backupPath) {
        return new Promise((resolve, reject) => {
            const tarFile = `${backupPath}.tar.gz`;
            const tar = spawn('tar', ['-czf', tarFile, '-C', path.dirname(backupPath), path.basename(backupPath)]);
            
            tar.on('close', (code) => {
                if (code === 0) {
                    logger.info('Backup compressed successfully', { file: tarFile });
                    resolve(tarFile);
                } else {
                    reject(new Error(`tar process exited with code ${code}`));
                }
            });
            
            tar.on('error', (error) => {
                reject(error);
            });
        });
    }

    removeDirectory(dirPath) {
        if (fs.existsSync(dirPath)) {
            fs.rmSync(dirPath, { recursive: true, force: true });
        }
    }

    cleanupOldBackups() {
        try {
            const backupFiles = fs.readdirSync(this.backupDir)
                .filter(file => file.startsWith('backup-'))
                .map(file => ({
                    name: file,
                    path: path.join(this.backupDir, file),
                    mtime: fs.statSync(path.join(this.backupDir, file)).mtime
                }))
                .sort((a, b) => b.mtime - a.mtime);

            // Keep only the most recent backups
            const backupsToDelete = backupFiles.slice(this.maxBackups);
            
            for (const backup of backupsToDelete) {
                try {
                    if (backup.name.endsWith('.tar.gz')) {
                        fs.unlinkSync(backup.path);
                    } else {
                        this.removeDirectory(backup.path);
                    }
                    logger.info('Deleted old backup', { name: backup.name });
                } catch (error) {
                    logger.warn('Failed to delete old backup', { 
                        name: backup.name, 
                        error: error.message 
                    });
                }
            }

            if (backupsToDelete.length > 0) {
                logger.info('Cleanup completed', { deleted: backupsToDelete.length });
            }

        } catch (error) {
            logger.error('Failed to cleanup old backups', { error: error.message });
        }
    }

    async restoreBackup(backupName) {
        try {
            const backupPath = path.join(this.backupDir, backupName);
            let manifestPath;
            let tempDir = null;

            // Handle compressed backups
            if (backupName.endsWith('.tar.gz')) {
                tempDir = path.join(this.backupDir, `temp-${Date.now()}`);
                fs.mkdirSync(tempDir, { recursive: true });
                
                await new Promise((resolve, reject) => {
                    const tar = spawn('tar', ['-xzf', backupPath, '-C', tempDir]);
                    tar.on('close', (code) => {
                        if (code === 0) resolve();
                        else reject(new Error(`tar extraction failed with code ${code}`));
                    });
                    tar.on('error', reject);
                });

                const extractedDir = fs.readdirSync(tempDir)[0];
                manifestPath = path.join(tempDir, extractedDir, 'backup-manifest.json');
            } else {
                manifestPath = path.join(backupPath, 'backup-manifest.json');
            }

            // Read backup manifest
            if (!fs.existsSync(manifestPath)) {
                throw new Error('Backup manifest not found');
            }

            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            const restoredFiles = [];

            // Restore configuration files
            for (const fileInfo of manifest.files) {
                const backupFilePath = tempDir 
                    ? path.join(tempDir, fs.readdirSync(tempDir)[0], fileInfo.file)
                    : path.join(backupPath, fileInfo.file);
                
                const restorePath = path.join(__dirname, fileInfo.file);

                if (fs.existsSync(backupFilePath)) {
                    // Create directory if needed
                    const restoreDir = path.dirname(restorePath);
                    if (!fs.existsSync(restoreDir)) {
                        fs.mkdirSync(restoreDir, { recursive: true });
                    }

                    // Create backup of current file
                    if (fs.existsSync(restorePath)) {
                        const backupCurrentPath = `${restorePath}.backup-${Date.now()}`;
                        fs.copyFileSync(restorePath, backupCurrentPath);
                        logger.info('Created backup of current file', { 
                            file: fileInfo.file,
                            backup: backupCurrentPath
                        });
                    }

                    // Restore file
                    fs.copyFileSync(backupFilePath, restorePath);
                    restoredFiles.push(fileInfo.file);
                    logger.info('Restored file', { file: fileInfo.file });
                }
            }

            // Cleanup temp directory
            if (tempDir && fs.existsSync(tempDir)) {
                this.removeDirectory(tempDir);
            }

            logger.info('Backup restored successfully', { 
                backup: backupName,
                files: restoredFiles.length,
                timestamp: manifest.timestamp
            });

            return {
                success: true,
                backup: backupName,
                files: restoredFiles.length,
                restoredFiles: restoredFiles,
                timestamp: manifest.timestamp
            };

        } catch (error) {
            logger.error('Failed to restore backup', { 
                backup: backupName, 
                error: error.message 
            });
            return {
                success: false,
                error: error.message
            };
        }
    }

    listBackups() {
        try {
            const backupFiles = fs.readdirSync(this.backupDir)
                .filter(file => file.startsWith('backup-'))
                .map(file => {
                    const filePath = path.join(this.backupDir, file);
                    const stats = fs.statSync(filePath);
                    return {
                        name: file,
                        size: stats.size,
                        created: stats.mtime.toISOString(),
                        compressed: file.endsWith('.tar.gz')
                    };
                })
                .sort((a, b) => new Date(b.created) - new Date(a.created));

            return {
                success: true,
                backups: backupFiles,
                count: backupFiles.length
            };

        } catch (error) {
            logger.error('Failed to list backups', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }

    startAutoBackup() {
        // Create initial backup
        setTimeout(() => {
            this.createBackup();
        }, 30000); // 30 seconds after startup

        // Schedule regular backups
        setInterval(() => {
            this.createBackup();
        }, this.backupInterval);

        logger.info('Auto-backup system started', { 
            interval: this.backupInterval / 1000 / 60 / 60 + ' hours',
            maxBackups: this.maxBackups
        });
    }

    getBackupStats() {
        try {
            const backupFiles = fs.readdirSync(this.backupDir)
                .filter(file => file.startsWith('backup-'));

            let totalSize = 0;
            for (const file of backupFiles) {
                const filePath = path.join(this.backupDir, file);
                totalSize += fs.statSync(filePath).size;
            }

            return {
                success: true,
                stats: {
                    count: backupFiles.length,
                    totalSize: totalSize,
                    totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
                    directory: this.backupDir,
                    maxBackups: this.maxBackups,
                    interval: this.backupInterval / 1000 / 60 / 60 + ' hours'
                }
            };

        } catch (error) {
            logger.error('Failed to get backup stats', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = BackupManager;
