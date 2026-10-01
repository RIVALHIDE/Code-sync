#!/bin/bash

# Script to install common language runtimes in Piston
# This installs the most popular languages for code execution

PISTON_URL="http://127.0.0.1:2000/api/v2/packages"

echo "Installing Piston language runtimes..."
echo "This may take several minutes depending on your internet connection."
echo ""

# Array of languages to install [language, version]
declare -a languages=(
    "python:3.10.0"
    "javascript:18.15.0"
    "java:15.0.2"
    "c:10.2.0"
    "c++:10.2.0"
    "go:1.16.2"
    "rust:1.68.2"
    "ruby:3.0.1"
    "php:8.2.3"
    "typescript:5.0.3"
)

installed=0
failed=0

for lang_ver in "${languages[@]}"; do
    IFS=':' read -r language version <<< "$lang_ver"
    echo -n "Installing $language $version... "
    
    response=$(curl -s -X POST "$PISTON_URL" \
        -H "Content-Type: application/json" \
        -d "{\"language\": \"$language\", \"version\": \"$version\"}" \
        --max-time 300)
    
    if echo "$response" | grep -q '"language"'; then
        echo "✓ Success"
        ((installed++))
    else
        echo "✗ Failed"
        echo "   Error: $response"
        ((failed++))
    fi
    
    # Small delay to avoid overwhelming the system
    sleep 1
done

echo ""
echo "================================"
echo "Installation Summary:"
echo "  Successful: $installed"
echo "  Failed: $failed"
echo "================================"
echo ""
echo "Verifying installed packages..."
curl -s http://127.0.0.1:2000/api/v2/runtimes | grep -o '"language":"[^"]*"' | sort -u

echo ""
echo "Done! Restart your frontend server for changes to take effect."
