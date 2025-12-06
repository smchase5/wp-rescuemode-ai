<?php
// deploy_loader.php
$source = __DIR__ . '/mu-loader/wp-rescue-suite-loader.php';
$target = dirname(dirname(__DIR__)) . '/mu-plugins/wp-rescue-suite-loader.php';

echo "Source: $source\n";
echo "Target: $target\n";

if (!file_exists($source)) {
    die("Error: Source file not found.\n");
}

if (!is_dir(dirname($target))) {
    if (!mkdir(dirname($target), 0755, true)) {
        die("Error: Cannot create mu-plugins directory.\n");
    }
}

if (copy($source, $target)) {
    echo "Success: Copied updated loader to mu-plugins.\n";
} else {
    echo "Error: Failed to copy file.\n";
}
