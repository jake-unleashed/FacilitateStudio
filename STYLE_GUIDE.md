# Facilitate Studio Style Guide

A comprehensive reference for all visual and styling patterns used in this application.

---

## 1. Design Philosophy

**"Liquid Glass" Aesthetic**
- Frosted glass panels with backdrop blur effects
- Floating UI layer pattern hovering over 3D canvas
- Light, airy, modern interface with soft edges
- High transparency with subtle borders for depth

---

## 2. Typography

### Font Families

| Purpose | Font | Tailwind Class |
|---------|------|----------------|
| Primary UI | Inter | `font-sans` |
| Code/Values | JetBrains Mono | `font-mono` |

### Font Weights

```
400 - Regular body text
500 - Medium emphasis
600 - Semibold (buttons, labels)
700 - Bold (headings, names)
800 - Extra bold (titles)
900 - Black (brand "Facilitate")
```

### Text Treatments

| Element | Size | Weight | Tracking | Additional |
|---------|------|--------|----------|------------|
| Brand title | text-xl | font-black | tracking-tight | leading-none |
| Brand subtitle | text-[9px] | font-bold | tracking-[0.35em] | uppercase |
| Panel headings | text-lg | font-bold | tracking-tight | — |
| Section labels | text-xs or text-[10px] | font-bold | tracking-widest | uppercase, text-slate-400 |
| Body text | text-sm | font-medium | — | text-slate-700 |
| Small labels | text-[10px] | font-semibold or font-medium | tracking-tight | — |
| Monospace values | text-xs | font-bold | — | font-mono |

---

## 3. Color Palette

### Primary Colors

| Name | Tailwind | Hex | Usage |
|------|----------|-----|-------|
| Blue 400 | `blue-400` | #60a5fa | Borders, focus rings |
| Blue 500 | `blue-500` | #3b82f6 | Interactive elements, completed states |
| Blue 600 | `blue-600` | #2563eb | Primary buttons, active states |
| Indigo 600 | `indigo-600` | #4f46e5 | Gradients with blue |

### Neutral Colors (Slate Scale)

| Name | Tailwind | Usage |
|------|----------|-------|
| slate-100 | `slate-100` | Canvas background, subtle backgrounds |
| slate-200 | `slate-200` | Inactive badges, dividers |
| slate-300 | `slate-300` | Dashed borders |
| slate-400 | `slate-400` | Muted text, labels |
| slate-500 | `slate-500` | Secondary text, icons |
| slate-600 | `slate-600` | Body text, section labels |
| slate-700 | `slate-700` | Primary text |
| slate-800 | `slate-800` | Headings, strong text |
| slate-900 | `slate-900` | Maximum contrast text |

### Accent Colors

| Color | Usage |
|-------|-------|
| `purple-500` / `purple-600` | Object type icons, gradients |
| `amber-500` | Navigation help icons |
| `red-500` / `red-600` | Delete actions, destructive |

### Glass/Transparency Colors

| Value | Usage |
|-------|-------|
| `rgba(255, 255, 255, 0.70)` | Panel backgrounds (`bg-white/70`) |
| `rgba(255, 255, 255, 0.65)` | Glass panel base |
| `rgba(255, 255, 255, 0.50)` | Secondary buttons, hover states |
| `rgba(255, 255, 255, 0.40)` | Borders (`border-white/40`) |
| `rgba(255, 255, 255, 0.20)` | Subtle borders |
| `rgba(255, 255, 255, 0.10)` | Panel header borders |
| `rgba(0, 0, 0, 0.05)` | Ghost button hover |

---

## 4. Border Radius System (Tiered Rounding)

| Tier | Value | Usage |
|------|-------|-------|
| **Tier 1** | `rounded-[32px]` | Major panels: sidebars, top bar, floating containers |
| **Tier 2** | `rounded-[20px]` | Cards, buttons (md/lg), inputs, content sections, nav items |
| **Tier 3** | `rounded-[12px]` | Small badges, icon containers, axis toggles, close buttons |
| **Full** | `rounded-full` | Icon-only buttons, step number badges |

---

## 5. Glass Panel Effect

### CSS Class (index.css)

```css
.glass-panel {
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.5);
}
```

### Tailwind Equivalent

```
bg-white/70 backdrop-blur-xl border border-white/40
```

### Panel Header Bars

```
h-16 border-b border-white/10 bg-white/10 backdrop-blur-sm px-6
```

---

## 6. Shadow System

### Custom Shadows (tailwind.config.js)

| Name | Value | Usage |
|------|-------|-------|
| `shadow-glass` | `0 8px 32px 0 rgba(31, 38, 135, 0.15)` | Main floating panels |
| `shadow-glass-sm` | `0 4px 16px 0 rgba(31, 38, 135, 0.10)` | Top bar, smaller panels |
| `shadow-glow` | `0 0 20px rgba(59, 130, 246, 0.5)` | Hover glow effect |

### Component-Specific Shadows

| Pattern | Usage |
|---------|-------|
| `shadow-lg shadow-blue-500/30` | Primary buttons, active nav items |
| `shadow-md shadow-purple-500/20` | Object type icon badges |
| `shadow-lg shadow-blue-500/10` | Upload icon container |
| `shadow-sm` | Cards, small elevated elements |

---

## 7. Button Component

### Variants

| Variant | Background | Border | Text | Shadow |
|---------|------------|--------|------|--------|
| `primary` | `bg-blue-600` | `border-blue-400/20` | `text-white` | `shadow-lg shadow-blue-500/30` |
| `secondary` | `bg-white/60 backdrop-blur-md` | `border-white/60` | `text-slate-800` | `shadow-sm` |
| `glass` | `bg-white/30 backdrop-blur-md` | `border-white/40` | `text-white` | `shadow-glass` |
| `guidance` | `bg-purple-500/10` | `border-purple-500/20` | `text-purple-700` | — |
| `ghost` | transparent | — | `text-slate-600` | — |
| `icon` | transparent | — | `text-slate-600` | — |

### Sizes

| Size | Padding | Text | Radius |
|------|---------|------|--------|
| `sm` | `px-3 py-1.5` | `text-xs` | `rounded-[12px]` |
| `md` | `px-5 py-2.5` | `text-sm` | `rounded-[20px]` |
| `lg` | `px-7 py-3.5` | `text-base` | `rounded-[20px]` |
| `icon` | `p-2.5` | — | `rounded-full` |

### Base Styles

```
inline-flex items-center justify-center font-semibold
transition-all duration-300
active:scale-95
disabled:opacity-50 disabled:cursor-not-allowed
```

---

## 8. Input Component

### Structure

```
Container: flex flex-col gap-2
Label: pl-1 text-[10px] font-bold uppercase tracking-widest text-slate-500
Input: rounded-[20px] border border-transparent bg-slate-100/50 px-4 py-2.5 text-sm
```

### States

| State | Styling |
|-------|---------|
| Default | `bg-slate-100/50 border-transparent` |
| Hover | `bg-slate-100/80` |
| Focus | `border-blue-400/50 bg-white ring-4 ring-blue-500/10` |
| Placeholder | `text-slate-400` |

### Inline Title Edit Input

```
w-[200px] border-b-2 border-blue-500 bg-transparent px-2 py-1
text-center text-sm font-bold text-slate-800
```

---

## 9. Panel Components

### Floating Panel Structure

```
Container: pointer-events-none absolute [position] z-40
Panel: pointer-events-auto rounded-[32px] border border-white/40 bg-white/70 
       shadow-glass backdrop-blur-xl
```

### Panel Header

```
h-16 shrink-0 border-b border-white/10 bg-white/10 px-6 backdrop-blur-sm
flex items-center justify-between
```

### Panel Content Area

```
flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar
```

### Close/Minimize Button

```
h-8 w-8 rounded-[12px] text-slate-500
hover:bg-white/50 hover:text-slate-800
```

---

## 10. Interactive States

### Hover States

| Element | Effect |
|---------|--------|
| Buttons | `hover:bg-[lighter]` background shift |
| Cards | `hover:scale-105 hover:bg-white hover:shadow-lg` |
| Nav items | `hover:bg-white/50 hover:text-slate-800` |
| Icons | `group-hover:scale-110 group-hover:rotate-12` |
| Panel | `hover:bg-white/80` (top bar) |

### Focus States

```
focus:outline-none focus:ring-4 focus:ring-blue-500/10
focus:border-blue-400/50
```

### Active States

```
active:scale-95
```

### Selected States

```
bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-1 ring-white/20
scale-[1.02] (list items)
```

### Disabled States

```
disabled:opacity-50 disabled:cursor-not-allowed
```

---

## 11. Icons

### Library

Lucide React (`lucide-react`)

### Standard Sizes

| Size | Usage |
|------|-------|
| 12px | Micro icons (pencil in title) |
| 14px | Small inline icons, list item icons |
| 16px | Button icons, standard inline |
| 18px | Navigation help icons, feature icons |
| 20px | Close buttons, medium prominence |
| 22px | Nav item primary icons |
| 24px | Upload/feature highlight icons |
| 28px | Asset library grid icons |

### Stroke Widths

| Weight | Value | Usage |
|--------|-------|-------|
| Default | 2 | Standard icons |
| Emphasis | 2.5 | Active nav items, help button |

### Icon Containers

**Navigation/Feature Icons:**
```
rounded-[20px] h-10 w-10 border border-white/60 bg-white/50 shadow-sm
```

**Small Badges:**
```
rounded-[12px] p-1.5 bg-white shadow-sm text-slate-400
```

**Object Type Badge:**
```
rounded-[12px] h-8 w-8 bg-gradient-to-br from-indigo-500 to-purple-600 
text-white shadow-md shadow-purple-500/20
```

---

## 12. Animation & Transitions

### Durations

| Duration | Usage |
|----------|-------|
| `duration-200` | Quick micro-interactions (toggles, focus) |
| `duration-300` | Standard transitions (hovers, color changes) |
| `duration-500` | Panel expand/collapse, major state changes |

### Easing

| Easing | Tailwind | Usage |
|--------|----------|-------|
| Standard | `ease-out` | Simple transitions |
| Smooth | `ease-[cubic-bezier(0.25,0.8,0.25,1)]` | Panel animations, complex movements |

### Transform Effects

| Effect | Usage |
|--------|-------|
| `scale-95` | Active/pressed state |
| `scale-[1.01]` | Subtle list item hover |
| `scale-[1.02]` | Selected list item |
| `scale-105` | Card hover |
| `scale-110` | Icon hover (group-hover) |
| `rotate-12` | Icon hover playful effect |
| `rotate-90` | Help button open state |
| `-rotate-6` | Upload icon hover |

### Panel Animations

**Expand from left:**
```
translate-x-0 opacity-100 (open)
-translate-x-8 opacity-0 (closed)
```

**Expand from bottom:**
```
translate-y-0 scale-100 opacity-100 (open)
translate-y-8 scale-90 opacity-0 (closed)
```

---

## 13. Scrollbar Styling

### Global Scrollbar (index.css)

```css
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
  margin: 4px;
}

::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}
```

### Panel Scrollbar (.custom-scrollbar)

```css
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 10px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.2);
}
```

---

## 14. Layout Patterns

### Floating UI Layer

```jsx
{/* Wrapper prevents click-through to canvas */}
<div className="pointer-events-none absolute ... z-[level]">
  {/* Interactive panel receives events */}
  <div className="pointer-events-auto ...">
    ...
  </div>
</div>
```

### Z-Index Layers

| Layer | Z-Index | Elements |
|-------|---------|----------|
| Canvas | z-0, z-10 | 3D canvas, gradient overlay |
| Sidebars | z-40 | Left sidebar, Right sidebar |
| Top UI | z-50 | Top bar, Navigation help |

### Edge Spacing

| Position | Value |
|----------|-------|
| Top | `top-4` (16px), `top-24` (96px for below top bar) |
| Left/Right | `left-4`, `right-4` (16px) |
| Bottom | `bottom-4`, `bottom-6` (16px, 24px) |

### Dividers

```
Vertical: h-6 w-px bg-slate-900/10
Horizontal: border-b border-white/10
```

---

## 15. 3D Canvas Background

### Container

```
bg-slate-100 absolute inset-0 h-full w-full overflow-hidden
```

### Gradient Overlay

```
bg-[radial-gradient(circle_at_center,_#f8fafc_0%,_#cbd5e1_100%)]
```

### Grid Configuration

| Property | Value |
|----------|-------|
| Section Color | `#94a3b8` (slate-400) |
| Cell Color | `#cbd5e1` (slate-300) |
| Section Thickness | 1.0 |
| Cell Thickness | 0.4 |
| Fade Distance | 40 units |

---

## 16. Special Components

### Step Card

```
rounded-[20px] border border-white/50 bg-white/50 p-4 shadow-sm backdrop-blur-sm
hover:bg-white hover:shadow-md
```

**Step Number Badge:**
```
h-6 w-6 rounded-full text-[10px] font-bold shadow-sm
Completed: bg-blue-500 text-white
Incomplete: bg-slate-200 text-slate-500
```

### Add Step Button (Dashed)

```
rounded-[20px] border border-dashed border-slate-300 bg-white/20 py-4
text-sm font-medium text-slate-500
hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-600
```

### Asset Grid Item

```
aspect-square rounded-[20px] border border-white/40 bg-white/40 p-3
hover:scale-105 hover:bg-white hover:shadow-lg
```

### Toggle Button Group

```
Container: rounded-[20px] border border-white/20 bg-slate-100/50 p-1
Button active: rounded-[12px] bg-white text-blue-600 shadow-sm ring-1 ring-black/5
Button inactive: rounded-[12px] text-slate-400 hover:bg-white/50
```

### Visibility Toggle Button

```
h-[42px] w-[42px] rounded-[20px] border
Visible: border-white/50 bg-white/50 text-blue-600 hover:shadow-sm
Hidden: border-transparent bg-slate-100/50 text-slate-400
```

### Range Slider

```
h-1.5 w-full appearance-none rounded-lg bg-slate-200 accent-blue-600
hover:accent-blue-500
```

**Range Labels:**
```
text-[10px] font-medium text-slate-400
```

---

## 17. Text Selection

```
selection:bg-blue-500/30 selection:text-white
```

---

## Quick Reference: Common Patterns

### Standard Glass Panel

```jsx
<div className="rounded-[32px] border border-white/40 bg-white/70 shadow-glass backdrop-blur-xl">
  ...
</div>
```

### Standard Card

```jsx
<div className="rounded-[20px] border border-white/40 bg-white/40 p-4 shadow-sm">
  ...
</div>
```

### Section Label

```jsx
<h3 className="pl-1 text-xs font-bold uppercase tracking-widest text-slate-400">
  Label
</h3>
```

### Value Badge

```jsx
<span className="rounded-[12px] border border-white/50 bg-white/50 px-2 py-0.5 font-mono text-xs font-bold text-slate-500 shadow-sm">
  1.00x
</span>
```

---

## File References

| File | Contains |
|------|----------|
| `tailwind.config.js` | Font families, custom shadows |
| `src/index.css` | Glass panel class, scrollbar styles |
| `src/components/Button.tsx` | Button variants and sizes |
| `src/components/Input.tsx` | Input field styling |
| `index.html` | Google Fonts imports |

