import os

replacements = {
    '#FF4500': '#9B516F',
    '#FF003C': '#5A3B69',
    '#FFEE00': '#70436B',
    '#000000': '#241C33',
    '#05050A': '#2D2140',
    '#070712': '#38284F',
    '#0A0A16': '#473263',
    'rgba(255, 69, 0': 'rgba(155, 81, 111',
    'rgba(255,69,0': 'rgba(155,81,111',
    'rgba(255, 0, 60': 'rgba(90, 59, 105',
    'rgba(255,0,60': 'rgba(90,59,105',
    'rgba(255, 238, 0': 'rgba(112, 67, 107',
    'rgba(255,238,0': 'rgba(112,67,107',
    'crt-grid': ''
}

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
        
    original = content
    for old, new in replacements.items():
        content = content.replace(old, new)
        
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
            
for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts') or file.endswith('.css'):
            process_file(os.path.join(root, file))

