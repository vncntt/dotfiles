#!/bin/bash
# setup.sh - Symlinks dotfiles and sets up development environment

DOTFILES_DIR="$HOME/dotfiles"
DOTFILES_BIN_DIR="$DOTFILES_DIR/bin"

# Symlink shell configuration files
ln -sf "$DOTFILES_DIR/.bash_aliases" ~/.bash_aliases
ln -sf "$DOTFILES_DIR/.vimrc" ~/.vimrc
ln -sf "$DOTFILES_DIR/.mcp.json" ~/.mcp.json


mkdir -p ~/.config/fish
ln -sf "$DOTFILES_DIR/config.fish" ~/.config/fish/config.fish

# Install Node.js locally if not available (for devcontainers)
NODE_VERSION="22.16.0"
if ! command -v node &>/dev/null; then
    if [ "$(uname -m)" = "aarch64" ]; then
        ARCH="arm64"
    else
        ARCH="x64"
    fi

    mkdir -p "$DOTFILES_DIR/.node" "$DOTFILES_BIN_DIR"
    curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${ARCH}.tar.xz" \
        | tar -xJ -C "$DOTFILES_DIR/.node" --strip-components=1

    # Symlink Node.js binaries to dotfiles bin directory
    while read -r file; do
        ln -sf "$file" "$DOTFILES_BIN_DIR/$(basename "$file")"
    done < <(find "$DOTFILES_DIR/.node/bin" -type f -executable)
fi

# Install Claude Code
if ! command -v claude &> /dev/null; then
    npm install -g @anthropic-ai/claude-code
fi

# === Claude Code Setup ===
CLAUDE_DIR="$HOME/.claude"
mkdir -p "$CLAUDE_DIR/hooks"

# Symlink settings (preserves plugins, permissions, hooks config)
ln -sf "$DOTFILES_DIR/.claude/settings.json" "$CLAUDE_DIR/settings.json"

# Copy hooks
cp "$DOTFILES_DIR/.claude/hooks/"* "$CLAUDE_DIR/hooks/"
chmod +x "$CLAUDE_DIR/hooks/"*

echo "dotfiles symlinked"
echo "Claude Code setup complete. Run 'claude login' to authenticate."
echo "Run 'source ~/.bashrc' or start a new shell to load aliases"
