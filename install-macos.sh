#!/bin/bash

# macOS Bitcoin Mining Installer
# Compatible with macOS 10.15+ and Apple Silicon

set -e

echo "🍎 macOS Bitcoin Mining Installer"
echo "══════════════════════════════════"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}❌ This script is for macOS only${NC}"
    exit 1
fi

# Check macOS version
MACOS_VERSION=$(sw_vers -productVersion)
echo -e "${BLUE}📱 macOS Version: $MACOS_VERSION${NC}"

# Check architecture
ARCH=$(uname -m)
if [[ "$ARCH" == "arm64" ]]; then
    echo -e "${BLUE}🔧 Architecture: Apple Silicon (ARM64)${NC}"
    BREW_PREFIX="/opt/homebrew"
else
    echo -e "${BLUE}🔧 Architecture: Intel (x86_64)${NC}"
    BREW_PREFIX="/usr/local"
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Install Homebrew if not present
install_homebrew() {
    if ! command_exists brew; then
        echo -e "${YELLOW}📦 Installing Homebrew...${NC}"
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        
        # Add Homebrew to PATH for Apple Silicon
        if [[ "$ARCH" == "arm64" ]]; then
            echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
            eval "$(/opt/homebrew/bin/brew shellenv)"
        fi
    else
        echo -e "${GREEN}✅ Homebrew already installed${NC}"
    fi
}

# Install dependencies
install_dependencies() {
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    
    # Update Homebrew
    brew update
    
    # Install required packages
    brew install autoconf automake libtool curl openssl gcc make git node
    
    # Create symlinks for OpenSSL (required by CPUMiner)
    if [[ ! -L "/usr/local/ssl" ]]; then
        sudo ln -sf "$BREW_PREFIX/opt/openssl" /usr/local/ssl
    fi
    
    echo -e "${GREEN}✅ Dependencies installed${NC}"
}

# Build CPUMiner
build_cpuminer() {
    echo -e "${YELLOW}🔨 Building CPUMiner...${NC}"
    
    # Clone CPUMiner if not exists
    if [[ ! -d "cpuminer" ]]; then
        echo -e "${BLUE}📥 Cloning CPUMiner repository...${NC}"
        git clone https://github.com/pooler/cpuminer.git
    fi
    
    cd cpuminer
    
    # Configure environment for Apple Silicon
    if [[ "$ARCH" == "arm64" ]]; then
        export LDFLAGS="-L$BREW_PREFIX/opt/openssl/lib"
        export CPPFLAGS="-I$BREW_PREFIX/opt/openssl/include"
        export PATH="$BREW_PREFIX/bin:$PATH"
    fi
    
    # Run autogen
    echo -e "${BLUE}🔧 Running autogen...${NC}"
    ./autogen.sh
    
    # Configure
    echo -e "${BLUE}🔧 Configuring build...${NC}"
    ./configure --with-crypto=$BREW_PREFIX/opt/openssl
    
    # Build
    echo -e "${BLUE}🔨 Building...${NC}"
    make -j$(sysctl -n hw.ncpu)
    
    # Copy binary
    cp minerd ../
    cd ..
    
    # Make executable
    chmod +x minerd
    
    echo -e "${GREEN}✅ CPUMiner built successfully${NC}"
}

# Install Node.js dependencies
install_node_deps() {
    echo -e "${YELLOW}📚 Installing Node.js dependencies...${NC}"
    
    # Ensure we have Node.js
    if ! command_exists node; then
        echo -e "${RED}❌ Node.js not found. Please install Node.js first.${NC}"
        exit 1
    fi
    
    # Install npm packages
    npm install
    
    echo -e "${GREEN}✅ Node.js dependencies installed${NC}"
}

# Create launch agent for auto-start
create_launch_agent() {
    echo -e "${YELLOW}⚙️ Creating launch agent...${NC}"
    
    local script_dir=$(pwd)
    local launch_agent_dir="$HOME/Library/LaunchAgents"
    local plist_file="$launch_agent_dir/com.bitcoin.mining.plist"
    
    # Create LaunchAgents directory if it doesn't exist
    mkdir -p "$launch_agent_dir"
    
    # Create plist file
    cat > "$plist_file" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.bitcoin.mining</string>
    <key>ProgramArguments</key>
    <array>
        <string>$(which node)</string>
        <string>$script_dir/bitcoin-mining-server.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$script_dir</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$script_dir/mining.log</string>
    <key>StandardErrorPath</key>
    <string>$script_dir/mining-error.log</string>
</dict>
</plist>
EOF
    
    echo -e "${GREEN}✅ Launch agent created${NC}"
    echo -e "${BLUE}💡 To auto-start: launchctl load $plist_file${NC}"
    echo -e "${BLUE}💡 To stop auto-start: launchctl unload $plist_file${NC}"
}

# Create start/stop scripts
create_scripts() {
    echo -e "${YELLOW}📝 Creating start/stop scripts...${NC}"
    
    # Start script
    cat > start-mining.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting Bitcoin Mining..."
node bitcoin-mining-server.js
EOF
    
    # Stop script
    cat > stop-mining.sh << 'EOF'
#!/bin/bash
echo "⏹️ Stopping Bitcoin Mining..."
pkill -f "node.*bitcoin-mining-server.js" 2>/dev/null
pkill -f "minerd" 2>/dev/null
echo "✅ Mining stopped"
EOF
    
    # Make scripts executable
    chmod +x start-mining.sh stop-mining.sh
    
    echo -e "${GREEN}✅ Scripts created${NC}"
}

# Main installation process
main() {
    echo -e "${BLUE}🚀 Starting macOS Bitcoin Mining installation...${NC}"
    
    # Check for Xcode Command Line Tools
    if ! xcode-select -p >/dev/null 2>&1; then
        echo -e "${YELLOW}📦 Installing Xcode Command Line Tools...${NC}"
        xcode-select --install
        echo -e "${YELLOW}⚠️ Please complete the Xcode Command Line Tools installation and run this script again.${NC}"
        exit 1
    fi
    
    install_homebrew
    install_dependencies
    build_cpuminer
    install_node_deps
    create_launch_agent
    create_scripts
    
    echo -e "${GREEN}🎉 Installation completed successfully!${NC}"
    echo ""
    echo -e "${BLUE}🎯 Next steps:${NC}"
    echo "1. Configure your wallet address in config/wallet.js"
    echo "2. Start mining: ./start-mining.sh"
    echo "3. Open dashboard: http://localhost:3000"
    echo "4. To auto-start on boot: launchctl load ~/Library/LaunchAgents/com.bitcoin.mining.plist"
    echo ""
    echo -e "${BLUE}📱 System Information:${NC}"
    echo "• macOS: $MACOS_VERSION"
    echo "• Architecture: $ARCH"
    echo "• CPU Cores: $(sysctl -n hw.ncpu)"
    echo "• Memory: $(sysctl -n hw.memsize | awk '{print $1/1024/1024/1024 " GB"}')"
    echo ""
    echo -e "${GREEN}✅ Ready to mine Bitcoin!${NC}"
}

# Run main function
main "$@"
