// The wizard subgraph and the legacy instance dialogs (ViewInstanceDialog,
// DeleteInstanceDialog, GenerateListDialog, AddSectionDialog,
// EditSectionDialog, SaveTemplateDialog, TemplateSelectionDialog,
// AddTitleTextDialog) were removed in v1.0.0 along with the rest of the
// wizard subgraph. Builder templates are now the only first-class concept.
//
// Per-template translation+generate (`translate-and-generate-dialog`) lives
// next to this file but is imported directly by the page; it intentionally
// doesn't re-export here so we don't grow another barrel.
export {};
