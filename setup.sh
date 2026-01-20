#!/bin/bash
# setup.sh - Symlinks dotfiles and sets up development environment

DOTFILES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Symlink shell configuration files
ln -sf "$DOTFILES_DIR/.bash_aliases" ~/.bash_aliases
ln -sf "$DOTFILES_DIR/.vimrc" ~/.vimrc
ln -sf "$DOTFILES_DIR/.mcp.json" ~/.mcp.json


mkdir -p ~/.config/fish
ln -sf "$DOTFILES_DIR/config.fish" ~/.config/fish/config.fish
fish -c "fish_add_path ~/.local/bin" 2>/dev/null || true

# Install Claude Code
if [[ ! -f "$HOME/.local/bin/claude" ]]; then
    curl -fsSL https://claude.ai/install.sh | bash
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
