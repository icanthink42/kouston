#!/bin/bash

KSP_PATH="/home/jack/.local/share/Steam/steamapps/common/Kerbal Space Program"
MOD_DIR="$KSP_PATH/GameData/Kouston"

# Build the mod
echo "Building Kouston..."
dotnet build -c Release

if [ $? -ne 0 ]; then
    echo "Build failed!"
    exit 1
fi

# Create mod directory in KSP if it doesn't exist
mkdir -p "$MOD_DIR/Plugins"

# Copy the built DLL
cp GameData/Kouston/Plugins/Kouston.dll "$MOD_DIR/Plugins/"

echo "Kouston installed to $MOD_DIR"
