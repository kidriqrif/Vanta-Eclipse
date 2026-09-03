import fs from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();
const OUT_DIR = path.join(ROOT_DIR, 'graphify-out');
const WIKI_DIR = path.join(OUT_DIR, 'wiki');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
if (!fs.existsSync(WIKI_DIR)) fs.mkdirSync(WIKI_DIR, { recursive: true });

function collectFiles(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(ROOT_DIR, fullPath);
    if (
      entry.name === 'node_modules' ||
      entry.name === '.git' ||
      entry.name === 'dist' ||
      entry.name === 'build' ||
      entry.name === 'graphify-out'
    ) {
      continue;
    }
    if (entry.isDirectory()) {
      collectFiles(fullPath, fileList);
    } else if (/\.(ts|tsx|js|jsx|json|md|html|css|gradle)$/.test(entry.name)) {
      fileList.push(relPath);
    }
  }
  return fileList;
}

const allFiles = collectFiles(ROOT_DIR);

const nodes = [];
const edges = [];
const nodeMap = new Map();

function addNode(id, label, type, file, community = 0, meta = {}) {
  if (!nodeMap.has(id)) {
    const n = { id, label, type, file, community, ...meta };
    nodeMap.set(id, n);
    nodes.push(n);
  }
  return nodeMap.get(id);
}

function addEdge(source, target, relation, confidence = 1.0) {
  if (source && target && source !== target) {
    edges.push({ source, target, relation, confidence });
  }
}

// Extract nodes & edges across the codebase
for (const relPath of allFiles) {
  const fullPath = path.join(ROOT_DIR, relPath);
  const content = fs.readFileSync(fullPath, 'utf-8');

  let community = 0;
  let category = 'Code';
  if (relPath.startsWith('src/components/')) {
    community = 1; // UI / HUD Components
    category = 'Component';
  } else if (relPath.startsWith('src/context/')) {
    community = 2; // State & Game Loop Core
    category = 'State';
  } else if (relPath.startsWith('src/data/')) {
    community = 3; // Game Data & Balance
    category = 'Data';
  } else if (relPath.startsWith('src/types/')) {
    community = 4; // TypeScript Types & Schemas
    category = 'Type';
  } else if (relPath.startsWith('design/')) {
    community = 5; // Design Specs & GDD
    category = 'Design';
  } else if (relPath.startsWith('docs/')) {
    community = 6; // Documentation & Policies
    category = 'Doc';
  } else if (relPath.startsWith('android/')) {
    community = 7; // Android & Native Build
    category = 'Native';
  } else {
    community = 8; // Config & Project Root
    category = 'Config';
  }

  const fileNodeId = `file:${relPath}`;
  addNode(fileNodeId, path.basename(relPath), 'file', relPath, community, { category });

  // Extract TypeScript / JavaScript imports
  if (/\.(ts|tsx|js|jsx)$/.test(relPath)) {
    const importRegex = /import\s+(?:\{([^}]+)\}|([a-zA-Z0-9_$]+))\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const named = match[1];
      const defaultImport = match[2];
      const targetPath = match[3];

      if (targetPath.startsWith('.')) {
        const resolved = path.normalize(path.join(path.dirname(relPath), targetPath));
        const matchedTarget = allFiles.find(
          (f) =>
            f.replace(/\.(ts|tsx|js|jsx)$/, '') === resolved.replace(/\\/g, '/') ||
            f === resolved.replace(/\\/g, '/')
        );
        if (matchedTarget) {
          addEdge(fileNodeId, `file:${matchedTarget}`, 'imports', 1.0);
        }
      } else {
        // External package
        const pkgNodeId = `pkg:${targetPath}`;
        addNode(pkgNodeId, targetPath, 'package', 'package.json', 8, { category: 'Dependency' });
        addEdge(fileNodeId, pkgNodeId, 'depends_on', 1.0);
      }

      if (named) {
        named.split(',').forEach((name) => {
          const trimmed = name.trim().split(' as ')[0].trim();
          if (trimmed) {
            const symId = `symbol:${trimmed}`;
            addNode(symId, trimmed, 'symbol', relPath, community, { category: 'Symbol' });
            addEdge(fileNodeId, symId, 'declares', 0.95);
          }
        });
      }
    }

    // Component declarations
    const compRegex = /export\s+const\s+([A-Z][a-zA-Z0-9_]+)\s*:\s*React\.FC/g;
    let cMatch;
    while ((cMatch = compRegex.exec(content)) !== null) {
      const cId = `component:${cMatch[1]}`;
      addNode(cId, cMatch[1], 'component', relPath, community, { category: 'UI' });
      addEdge(fileNodeId, cId, 'renders', 1.0);
    }
  }
}

// Specific system connections
addEdge('component:AdBanner', 'pkg:@capacitor-community/admob', 'integrates_sdk', 1.0);
addEdge('file:src/App.tsx', 'component:AdBanner', 'renders_banner', 1.0);
addEdge('component:AdBanner', 'symbol:useGame', 'reads_ad_state', 1.0);
addEdge('file:src/context/GameContext.tsx', 'symbol:useGame', 'provides', 1.0);

const communities = {
  0: 'General Architecture',
  1: 'User Interface & HUD Matrix',
  2: 'Combat Engine & Game State Loop',
  3: 'Game Progression & Definitions',
  4: 'Type Contracts & Interfaces',
  5: 'Game Design & System Specs',
  6: 'Documentation & Privacy Compliance',
  7: 'Android Native & Capacitor Wrappers',
  8: 'Tooling & Package Ecosystem',
};

// Calculate degrees to find God Nodes
const degrees = new Map();
edges.forEach((e) => {
  degrees.set(e.source, (degrees.get(e.source) || 0) + 1);
  degrees.set(e.target, (degrees.get(e.target) || 0) + 1);
});

const sortedNodes = [...nodes].sort(
  (a, b) => (degrees.get(b.id) || 0) - (degrees.get(a.id) || 0)
);

const godNodes = sortedNodes.slice(0, 7).map((n) => ({
  id: n.id,
  label: n.label,
  file: n.file,
  degree: degrees.get(n.id) || 0,
}));

// Build graph.json
const graphData = {
  nodes,
  edges,
  communities,
  godNodes,
  stats: {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    totalFiles: allFiles.length,
    updatedAt: new Date().toISOString(),
    version: '1.3.0',
  },
};

fs.writeFileSync(path.join(OUT_DIR, 'graph.json'), JSON.stringify(graphData, null, 2));

// Generate GRAPH_REPORT.md
const reportContent = `# Knowledge Graph Audit Report — Vanta Eclipse (v1.3.0)

**Generated:** ${new Date().toISOString()}  
**Total Indexed Files:** ${allFiles.length}  
**Nodes:** ${nodes.length} | **Edges:** ${edges.length} | **Communities:** 9

## 1. Executive Summary & Architecture Overview

Vanta Eclipse is a responsive portrait idle RPG built with React 18, TypeScript, Tailwind CSS, and Capacitor for Android native packaging. The codebase is organized into distinct decoupled domains:
- **Core State & Simulation Engine** (\`src/context/GameContext.tsx\`): Centralized authoritative state machine handling combat calculations, offline progression, currency accumulators, and AdMob rewarded/banner handlers.
- **HUD & Navigation Matrix** (\`src/components/\`): Pure, reactive presentation panels with high-contrast obsidian aesthetic, custom typography (Rajdhani, Space Mono), and zero-clutter layouts.
- **Monetization & Ad Infrastructure** (\`src/components/AdBanner.tsx\` + AdMob): Non-intrusive banner ad container at bottom navigation with seamless native AdMob bridge and web sponsor fallbacks.
- **Progression & Balance Matrix** (\`src/data/definitions.ts\`): 12 Dungeon Worlds, Relics, Beast Companions, Ascendant Skill Matrix, and Quests.

## 2. God Nodes (Highest Connectivity Hubs)

${godNodes
  .map(
    (g, idx) =>
      `${idx + 1}. **\`${g.label}\`** (\`${g.file}\`): **${g.degree}** connections. Central orchestrator for system dependencies and state flow.`
  )
  .join('\n')}

## 3. Communities & Domain Clusters

${Object.entries(communities)
  .map(([id, name]) => {
    const count = nodes.filter((n) => n.community === parseInt(id, 10)).length;
    return `- **Community ${id} (${name})**: ${count} nodes`;
  })
  .join('\n')}

## 4. Surprising Connections

- **AdBanner $\\leftrightarrow$ GameContext (\`hasRemovedAds\`)**: Automatic dynamic suppression when a player purchases the "Remove Ads" Supporter Pack.
- **AdMob Plugin $\\leftrightarrow$ Dual Target Engine**: Native AdMob Banner & Rewarded Video on Android, with automated smooth fallback on web preview.
- **CombatArena $\\leftrightarrow$ Starlight Atmosphere**: Dynamic particle simulation and screen-shake calculations that scale with player attack speed and critical strike multipliers.

## 5. Suggested Questions

1. *How does the AdBanner component interact with the player's ad removal status in GameContext?*
2. *Where are the 12 Dungeon World tiers and their boss scaling formulas defined?*
3. *How does the offline rewards calculator compute live essence rates and shard gains during background absence?*
`;

fs.writeFileSync(path.join(OUT_DIR, 'GRAPH_REPORT.md'), reportContent);

// Generate wiki/index.md
const wikiIndex = `# Vanta Eclipse Knowledge Base

Welcome to the knowledge base generated from the codebase graph.

## Communities

${Object.entries(communities)
  .map(
    ([id, name]) =>
      `- [Community ${id}: ${name}](./community-${id}.md) — Overview of key components and data structures.`
  )
  .join('\n')}

## Architecture Highlights
- [Architecture Documentation](../../docs/ARCHITECTURE.md)
- [GDD & Mechanics](../../design/gdd/)
- [Release Checklist](../../design/RELEASE-CHECKLIST.md)
`;

fs.writeFileSync(path.join(WIKI_DIR, 'index.md'), wikiIndex);

// Generate individual community articles
Object.entries(communities).forEach(([id, name]) => {
  const cNodes = nodes.filter((n) => n.community === parseInt(id, 10));
  const cContent = `# Community ${id}: ${name}

**Total Entities:** ${cNodes.length}

## Key Nodes in this Domain

${cNodes
  .slice(0, 30)
  .map((n) => `- **${n.label}** (\`${n.type}\` in \`${n.file}\`)`)
  .join('\n')}
`;
  fs.writeFileSync(path.join(WIKI_DIR, `community-${id}.md`), cContent);
});

// Generate graph.html visualizer
const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Vanta Eclipse — Knowledge Graph</title>
  <style>
    body { margin: 0; background: #07070D; color: #F8F8FC; font-family: -apple-system, BlinkMacSystemFont, sans-serif; overflow: hidden; }
    #header { position: absolute; top: 12px; left: 16px; z-index: 10; background: rgba(18,18,30,0.9); padding: 10px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); }
    h1 { margin: 0 0 4px 0; font-size: 16px; color: #2ED1F4; }
    p { margin: 0; font-size: 11px; color: #8888A4; }
    canvas { width: 100vw; height: 100vh; display: block; }
  </style>
</head>
<body>
  <div id="header">
    <h1>VANTA ECLIPSE KNOWLEDGE GRAPH</h1>
    <p>Nodes: ${nodes.length} | Edges: ${edges.length} | Version: 1.3.0</p>
  </div>
  <canvas id="graphCanvas"></canvas>
  <script>
    const canvas = document.getElementById('graphCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const data = ${JSON.stringify({ nodes: nodes.slice(0, 150), edges: edges.slice(0, 300) })};
    const nodePositions = new Map();

    data.nodes.forEach((n, i) => {
      const angle = (i / data.nodes.length) * Math.PI * 2;
      const radius = 220 + (n.community * 25) + Math.random() * 80;
      nodePositions.set(n.id, {
        x: canvas.width / 2 + Math.cos(angle) * radius,
        y: canvas.height / 2 + Math.sin(angle) * radius,
        color: ['#FF334B', '#2ED1F4', '#58D635', '#FFC820', '#A050FF', '#FF5EBA', '#00F0FF', '#E2E8F0', '#94A3B8'][n.community % 9]
      });
    });

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;

      data.edges.forEach(e => {
        const p1 = nodePositions.get(e.source);
        const p2 = nodePositions.get(e.target);
        if (p1 && p2) {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      });

      data.nodes.forEach(n => {
        const p = nodePositions.get(n.id);
        if (!p) return;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#C2C2D6';
        ctx.font = '9px monospace';
        ctx.fillText(n.label, p.x + 6, p.y + 3);
      });
    }
    draw();
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(OUT_DIR, 'graph.html'), htmlContent);

console.log(`Successfully generated graphify knowledge graph: ${nodes.length} nodes, ${edges.length} edges in graphify-out/`);
