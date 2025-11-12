# Dashboard Layout Definitions

This folder contains the JSON definitions for all predefined dashboard layouts.

## Single Source of Truth

These JSON files are the **single source of truth** for layout definitions. They are:
- Automatically imported by `src/components/dashboard/utils/predefinedLayouts.ts`
- Used to generate TypeScript exports at build time
- Maintained in one place to avoid duplication

## Adding a New Layout

To add a new predefined layout:

1. Create a new JSON file in this directory (e.g., `my-layout.json`)
2. Follow the structure of existing layouts:
   ```json
   {
     "name": "Layout Name",
     "description": "Description of the layout",
     "version": "1.0",
     "layout_config": {
       "lg": [...],
       "md": [...],
       "sm": [...]
     }
   }
   ```
3. Import it in `predefinedLayouts.ts`
4. Add it to the `PREDEFINED_LAYOUTS` array

## Layout Structure

Each layout must define three responsive breakpoints:
- `lg`: Large screens (≥1200px) - 12 columns
- `md`: Medium screens (≥768px) - 8 columns  
- `sm`: Small screens (<768px) - 4 columns

Each grid item requires:
- `i`: Widget ID (must match available widgets)
- `x`, `y`: Grid position
- `w`, `h`: Width and height in grid units
- `minW`, `minH`: Minimum dimensions

## Documentation

For documentation about these layouts, see the main `docs/layouts/` folder in the project root.
