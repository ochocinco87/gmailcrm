#!/usr/bin/env python3
"""Generate simple placeholder icons for the Chrome extension."""

from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, filename):
    """Create a simple icon with gradient background."""
    # Create image with gradient
    img = Image.new('RGB', (size, size), color='#1a73e8')
    draw = ImageDraw.Draw(img)

    # Draw a simple pipeline representation
    col_width = size // 5
    col_height = size // 2
    margin = size // 6

    # Three columns (pipeline stages)
    colors = ['#4285f4', '#34a853', '#fbbc04']
    for i, color in enumerate(colors):
        x = margin + (i * (col_width + margin // 2))
        y = margin
        draw.rectangle([x, y, x + col_width, y + col_height], fill=color)

    # Save
    img.save(filename, 'PNG')
    print(f'Created {filename}')

if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)

    create_icon(16, 'icon16.png')
    create_icon(48, 'icon48.png')
    create_icon(128, 'icon128.png')

    print('All icons created successfully!')
