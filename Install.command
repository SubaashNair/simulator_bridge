#!/bin/zsh
cd -- "${0:A:h}" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
if ! command -v node >/dev/null; then
  print 'Node.js 20 or newer is required. Install it from https://nodejs.org first.'
else
  node install.mjs
fi
print '\nPress Return to close.'
read -r
