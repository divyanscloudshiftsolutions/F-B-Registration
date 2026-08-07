# Button Interaction States Design Specification

This document serves as the **single source of truth** for all button, tab, icon button, and interactive control interaction states across the application. All UI implementation and reviews must adhere strictly to these rules.

---

## 1. Standard Interaction Flow

Every interactive element follows a 4-step sequence:

| Step | State | Description | Persistent / Temporary | Style Treatment Guidelines |
| :--- | :--- | :--- | :--- | :--- |
| **Step 1** | **Default (Normal)** | The base state of the control before any user interaction. | Persistent | Glass border, low background opacity, muted text/icon. |
| **Step 2** | **Hover** | Triggered when the pointer device hovers over the element. | Temporary | Subtle highlight, slight background brightening, border illumination. |
| **Step 3** | **Active / Selected** | The persistent state after a button or tab has been clicked/selected. | **Persistent** | Brand Purple accent (`bg-primary`), full opacity, white text. |
| **Step 4** | **Pressed / Clicked** | Triggered *only* while the user is physically clicking/pressing the button (mouse down / touch start). | **Temporary** | Micro-scaling (`active:scale-95`), transition-all, automatically snaps back to **Step 3** upon release. |

---

## 2. Strict Constraints

1. **Step 3 Primacy**: The "Active/Selected" state must always be the persistent, visible state highlighting the active option or current page/filter selection.
2. **Step 4 Temporariness**: The "Pressed/Clicked" state (using Tailwind's `active:` classes) is strictly transient. It must **never** remain active or locked after the touch or click release is completed.
3. **No Glow Inflation**: Never increase glow intensities or introduce visual clutter on hover/active states. Refinement must rely on clean scale physics and border highlights.

---

## 3. Reference Tailwind Implementation

```tsx
// Example of a premium tab button complying with all 4 states
<button
  onClick={onClick}
  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer
    /* Step 1 & 2: Default & Hover (when not selected) */
    ${!selected ? 'text-text-muted hover:text-text-primary hover:bg-white/5 border border-transparent' : ''}
    /* Step 3: Active / Selected (Persistent) */
    ${selected ? 'bg-primary text-white border border-primary-hover shadow-md shadow-primary/20' : ''}
    /* Step 4: Pressed / Clicked (Temporary) */
    active:scale-95`}
>
  Button Text
</button>
```
