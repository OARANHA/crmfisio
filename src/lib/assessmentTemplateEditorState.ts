export function assessmentEditorNeedsCloseConfirmation(
  initialSnapshot: string | null,
  currentSnapshot: string,
  busy: boolean,
): boolean {
  return !busy && initialSnapshot !== null && initialSnapshot !== currentSnapshot;
}
