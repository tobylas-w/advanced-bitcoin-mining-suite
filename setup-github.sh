#!/bin/bash

echo "🚀 Advanced Bitcoin Mining Suite - GitHub Setup"
echo "================================================"
echo ""

# Function to prompt for input
prompt_input() {
    local prompt="$1"
    local var_name="$2"
    echo -n "$prompt: "
    read -r "$var_name"
}

# Get user information
echo "First, let's set up your Git configuration:"
echo ""

prompt_input "Enter your GitHub username" GITHUB_USERNAME
prompt_input "Enter your email address" GITHUB_EMAIL

# Set Git configuration
echo ""
echo "Setting up Git configuration..."
git config --global user.name "$GITHUB_USERNAME"
git config --global user.email "$GITHUB_EMAIL"

echo "✅ Git configuration set!"
echo ""

# Ask about repository creation method
echo "How would you like to create the GitHub repository?"
echo "1) I'll create it manually on GitHub.com"
echo "2) Use GitHub CLI (requires authentication)"
echo "3) Show me the manual commands"
echo ""

prompt_input "Enter your choice (1, 2, or 3)" CHOICE

case $CHOICE in
    1)
        echo ""
        echo "📋 MANUAL REPOSITORY CREATION"
        echo "=============================="
        echo ""
        echo "1. Go to https://github.com/new"
        echo "2. Repository name: advanced-bitcoin-mining-suite"
        echo "3. Description: Advanced cross-platform Bitcoin mining management system with real-time dashboard, security features, and stealth capabilities"
        echo "4. Make it Public or Private (your choice)"
        echo "5. DON'T initialize with README (we already have one)"
        echo "6. Click 'Create repository'"
        echo ""
        echo "After creating the repository, run these commands:"
        echo ""
        echo "git remote add origin https://github.com/$GITHUB_USERNAME/advanced-bitcoin-mining-suite.git"
        echo "git branch -M main"
        echo "git push -u origin main"
        echo ""
        ;;
    2)
        echo ""
        echo "🔐 GITHUB CLI AUTHENTICATION"
        echo "============================"
        echo ""
        echo "Let's authenticate with GitHub CLI..."
        echo "This will open a browser window for authentication."
        echo ""
        read -p "Press Enter to continue with GitHub CLI authentication..."
        
        # Try to authenticate
        if gh auth login --web; then
            echo ""
            echo "✅ Authentication successful!"
            echo ""
            echo "Creating repository on GitHub..."
            if gh repo create advanced-bitcoin-mining-suite \
                --description "Advanced cross-platform Bitcoin mining management system with real-time dashboard, security features, and stealth capabilities" \
                --public \
                --source=. \
                --remote=origin \
                --push; then
                echo ""
                echo "🎉 Repository created and pushed successfully!"
                echo "View it at: https://github.com/$GITHUB_USERNAME/advanced-bitcoin-mining-suite"
            else
                echo "❌ Failed to create repository with GitHub CLI"
                echo "Falling back to manual method..."
                echo ""
                echo "Please create the repository manually at https://github.com/new"
                echo "Then run:"
                echo "git remote add origin https://github.com/$GITHUB_USERNAME/advanced-bitcoin-mining-suite.git"
                echo "git branch -M main"
                echo "git push -u origin main"
            fi
        else
            echo "❌ Authentication failed"
            echo "Please create the repository manually at https://github.com/new"
            echo "Then run:"
            echo "git remote add origin https://github.com/$GITHUB_USERNAME/advanced-bitcoin-mining-suite.git"
            echo "git branch -M main"
            echo "git push -u origin main"
        fi
        ;;
    3)
        echo ""
        echo "📋 MANUAL COMMANDS"
        echo "=================="
        echo ""
        echo "1. Create repository at https://github.com/new"
        echo "   - Name: advanced-bitcoin-mining-suite"
        echo "   - Description: Advanced cross-platform Bitcoin mining management system with real-time dashboard, security features, and stealth capabilities"
        echo "   - Public or Private (your choice)"
        echo "   - Don't initialize with README"
        echo ""
        echo "2. Run these commands in your terminal:"
        echo ""
        echo "   git remote add origin https://github.com/$GITHUB_USERNAME/advanced-bitcoin-mining-suite.git"
        echo "   git branch -M main"
        echo "   git push -u origin main"
        echo ""
        ;;
    *)
        echo "Invalid choice. Please run the script again."
        exit 1
        ;;
esac

echo ""
echo "🎯 NEXT STEPS"
echo "============="
echo ""
echo "After pushing to GitHub:"
echo "1. Go to your repository settings"
echo "2. Add topics: bitcoin, mining, cryptocurrency, nodejs, security"
echo "3. Enable Issues, Projects, Wiki, Discussions"
echo "4. Set up branch protection rules"
echo "5. Create your first release (v2.0.0)"
echo ""
echo "📖 Documentation:"
echo "- README.md: Main project documentation"
echo "- SECURITY-GUIDE.md: Security configuration"
echo "- SYSTEM-OVERVIEW.md: Complete system guide"
echo "- GITHUB-SETUP.md: Detailed GitHub setup guide"
echo ""
echo "🚀 Your Bitcoin mining system is ready for GitHub!"
echo ""
