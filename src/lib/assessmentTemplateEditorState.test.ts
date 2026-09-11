import { describe, expect, it } from 'vitest';
import { assessmentEditorNeedsCloseConfirmation } from './assessmentTemplateEditorState';

describe('assessment editor close state', () => {
  it('requires confirmation only for dirty, non-busy editors', () => {
    expect(assessmentEditorNeedsCloseConfirmation('{"name":"A"}', '{"name":"B"}', false)).toBe(true);
    expect(assessmentEditorNeedsCloseConfirmation('{"name":"A"}', '{"name":"A"}', false)).toBe(false);
    expect(assessmentEditorNeedsCloseConfirmation('{"name":"A"}', '{"name":"B"}', true)).toBe(false);
  });
});
