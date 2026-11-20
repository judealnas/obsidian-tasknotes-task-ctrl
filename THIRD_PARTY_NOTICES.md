# TaskNotes adaptations

Source: https://github.com/callumalpass/tasknotes
Revision: a2414b67be2ce742f50f657f71098eeb2e80311b (4.18.2).

Adapted: src/modals/TaskSelectorWithCreateModal.ts (display-only layout and inline creation interaction),
src/services/buildTaskCreationDataFromParsed.ts, src/utils/dateUtils.ts and
src/utils/taskIdentificationFrontmatter.ts (payload/date/tag normalization).
Owned adaptations: src/ui/TaskPickerRow.ts, src/ui/TaskPickerModal.ts and src/model/taskCreation.ts.
Modifications: public API only, default omission, custom-field validation, explicit preview/title confirmation,
acknowledged destination routing, cancellation, safe static rows and scoped styling.
No upstream CSS is copied. Type-only public API subsets are in src/tasknotes/runtime-api.types.ts.

## TaskNotes MIT license

Copyright 2025 Callum Alpass

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
