# FRONTEND STACK

The plan for creating default frontend stack for mylly.

## THE GOAL

- IE9+ support.
- Full support and optimum usability for touch devices.
- Accessible (https://www.w3.org/TR/wai-aria/ + https://github.com/a11y-api/a11y-api/blob/master/explainer.md).
- Component based system (easy to include and customize only the sutff that's needed).
- REM units all the way.
- 4 main target resolutions:
  - mobile (widths: 320 - 767)
  - tablet (widths: 768 - 1024)
  - desktop (widths: 1025 - 1920)
  - 4K/UHD (widths: 1921 - 3840)

## THE STACK

- Base:
  - Sass mixins from http://bourbon.io/
  - Normalize
  - Palikka
  - jQuery
- Components:
  - Typography
    - Vertical rhythm
  - Layout
    - Grid system
    - Vertically centered content
    - Elastic fullscreen blocks
  - Tables
    - Strategy for mobile
    - Sticky table header
  - Forms
    - Switch UI
    - Selectize-like component
  - Buttons
  - Navigation bar
  - Slideout navigation
  - Tabs
  - Accordions
  - Modals
  - Tooltips
  - Dropdowns
  - Pagination
  - Breadcrumbs
  - Alerts / Callouts
  - Carousel
  - Embedded video
  - Fullscreen image/video backgrounds
  - Generic toggle (anything)
  - SVG icon set