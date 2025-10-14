#!/bin/bash
# setup.sh

ln -sf ~/dotfiles/.bash_aliases ~/.bash_aliases
ln -sf ~/dotfiles/vimrc ~/.vimrc

mkdir -p ~/.config/fish
ln -sf ~/dotfiles/config.fish ~/.config/fish/config.fish

echo "dotfiles symlinked"
echo "Run 'source ~/.bashrc' or start a new shell to load aliases"
