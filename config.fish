set -gx PATH ~/.local/bin ~/dotfiles/bin $PATH
set -gx AWS_PROFILE production

alias g='git'
alias gc='git commit'
alias gl='git pull'
alias gu='git push'
alias gf='git fetch'
alias gw='git switch'
alias gs='git status'
alias ga='git add'
alias gb='git branch'

alias p='python3'
alias python='python3'
alias c='clear'
alias cdsp='claude --dangerously-skip-permissions'
alias dl='dvc pull'
alias du='dvc push'
alias dr='dvc repro'

fish_vi_key_bindings
bind -M insert -m default jk repaint-mode