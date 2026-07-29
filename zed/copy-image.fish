#!/usr/bin/env fish
# Copy an image file to the macOS clipboard as an actual image (not a path).
# Used by the Zed task "Copy current image": the keybinding first runs Zed's
# CopyPath action, so the clipboard holds the image's path when this runs.
# Takes the path as $argv[1], or falls back to reading it from the clipboard.

set log_file /tmp/zed-copy-image.log
echo (date +%T)" invoked with argv: $argv" >> $log_file

if test (count $argv) -ge 1
    set source_image $argv[1]
else
    set source_image (pbpaste)
end
echo (date +%T)" source: $source_image" >> $log_file

if not test -f "$source_image"
    echo (date +%T)" ERROR: not a file, leaving clipboard alone" >> $log_file
    exit 1
end

set temp_dir (mktemp -d -t zed-copy-image)
set temp_image "$temp_dir/image.png"

# Convert to PNG so any format Zed can display (jpg, webp, gif, ...) works.
if not sips -s format png "$source_image" --out "$temp_image" >/dev/null 2>>$log_file
    echo (date +%T)" ERROR: sips failed on $source_image" >> $log_file
    rm -rf "$temp_dir"
    exit 1
end

osascript \
    -e 'on run argv' \
    -e 'set the clipboard to (read (POSIX file (item 1 of argv)) as «class PNGf»)' \
    -e 'end run' \
    "$temp_image"

set result $status
echo (date +%T)" osascript exit: $result" >> $log_file
rm -rf "$temp_dir"
exit $result
