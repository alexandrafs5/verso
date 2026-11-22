/** Keys under `auth.validation`. Shared Zod messages are English, so the UI maps issues to copy. */
export type ValidationKey =
  | 'emailRequired'
  | 'emailInvalid'
  | 'passwordRequired'
  | 'passwordTooShort'
  | 'passwordTooLong'
  | 'nameRequired'
  | 'nameTooLong';

type Field = 'name' | 'email' | 'password';

/**
 * Picks the message for a failed field from the Zod issue code (react-hook-form's `error.type`)
 * and the current value. Returns undefined when the field has no error.
 */
export function validationKey(
  field: Field,
  issueCode: string | undefined,
  value: string,
): ValidationKey | undefined {
  if (issueCode === undefined) return undefined;

  switch (field) {
    case 'email':
      return value.trim() === '' ? 'emailRequired' : 'emailInvalid';
    case 'name':
      return issueCode === 'too_big' ? 'nameTooLong' : 'nameRequired';
    case 'password':
      if (value === '') return 'passwordRequired';
      return issueCode === 'too_big' ? 'passwordTooLong' : 'passwordTooShort';
  }
}
