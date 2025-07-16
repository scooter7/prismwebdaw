# AI Rules for WebDAW Development

This document outlines the technical stack and development guidelines for the WebDAW application.

## Tech Stack Overview

*   **Frontend Framework:** React (version 18.2.0) for building the user interface.
*   **Language:** TypeScript (version 4.9.5) for type safety and improved developer experience.
*   **UI Library:** BlueprintJS (`@blueprintjs/core`, `@blueprintjs/icons`, `@blueprintjs/select`, `@blueprintjs/table`) for pre-built UI components and consistent styling.
*   **Styling:** CSS Modules (`.module.css` files) are used for component-scoped styling, alongside BlueprintJS's CSS.
*   **Audio Processing:** Leverages native Web Audio API for in-browser audio synthesis, processing, and playback.
*   **MIDI Integration:** Utilizes native Web MIDI API for connecting with MIDI devices.
*   **Build Tool:** Create React App (via `react-scripts`) for project setup, development server, and build processes.
*   **Utility Libraries:** `lodash` for general utility functions, `data-structure-typed` for specific data structures.
*   **Icons:** BlueprintJS Icons (`@blueprintjs/icons`) are used for visual elements.

## Library Usage Rules

*   **UI Components:** Prefer using components from the **BlueprintJS** library. If a specific component is not available or requires significant customization, create a new, small, and focused custom component.
*   **Styling:** Apply styling using **CSS Modules** (`.module.css` files) for component-specific styles. For global styles or overrides, use `src/index.css`.
*   **Audio/MIDI:** Directly interact with the **Web Audio API** and **Web MIDI API** for all audio and MIDI-related functionalities. Avoid third-party wrappers unless explicitly approved for specific, complex use cases.
*   **Data Structures:** Utilize `data-structure-typed` for complex data structures where appropriate.
*   **General Utilities:** Use `lodash` for common utility functions (e.g., `clone`, `cloneDeep`).
*   **Icons:** Use icons provided by **BlueprintJS Icons**.
*   **Routing:** The application currently does not use a client-side routing library. All main views are rendered directly within `src/App.tsx`.
*   **State Management:** For application-wide state, the React Context API is used (e.g., `EngineContext`, `AudioFileManagerContext`). For component-local state, use React's `useState` and `useReducer` hooks.

## Important Considerations

*   **Component Structure:** Always create a new, separate file for every new React component or hook. Components should ideally be 100 lines of code or less.
*   **File Naming:** Directory names should be all lower-case (e.g., `src/pages`, `src/components`). File names may use mixed-case.
*   **Error Handling:** Do not implement `try/catch` blocks for errors unless specifically requested. Errors should generally bubble up for easier debugging.
*   **Responsiveness:** All new UI components and layouts should be designed to be responsive across different screen sizes.
*   **Toasts:** Use toast notifications to inform the user about important events. (Note: A toast library is not currently installed, this would require adding one).