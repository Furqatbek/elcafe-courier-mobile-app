/**
 * Form validation utilities for the Courier App
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

// Email validation
export const validateEmail = (email: string): ValidationResult => {
  if (!email || email.trim() === '') {
    return { isValid: false, error: 'Email is required' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  return { isValid: true };
};

// Password validation
export const validatePassword = (password: string, minLength: number = 6): ValidationResult => {
  if (!password || password.trim() === '') {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length < minLength) {
    return { isValid: false, error: `Password must be at least ${minLength} characters` };
  }

  return { isValid: true };
};

// Strong password validation
export const validateStrongPassword = (password: string): ValidationResult => {
  if (!password || password.trim() === '') {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters' };
  }

  if (!/[A-Z]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one uppercase letter' };
  }

  if (!/[a-z]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one lowercase letter' };
  }

  if (!/[0-9]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one number' };
  }

  return { isValid: true };
};

// Confirm password validation
export const validateConfirmPassword = (password: string, confirmPassword: string): ValidationResult => {
  if (!confirmPassword || confirmPassword.trim() === '') {
    return { isValid: false, error: 'Please confirm your password' };
  }

  if (password !== confirmPassword) {
    return { isValid: false, error: 'Passwords do not match' };
  }

  return { isValid: true };
};

// Phone number validation
export const validatePhone = (phone: string): ValidationResult => {
  if (!phone || phone.trim() === '') {
    return { isValid: false, error: 'Phone number is required' };
  }

  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 10) {
    return { isValid: false, error: 'Please enter a valid phone number' };
  }

  return { isValid: true };
};

// Required field validation
export const validateRequired = (value: string, fieldName: string = 'This field'): ValidationResult => {
  if (!value || value.trim() === '') {
    return { isValid: false, error: `${fieldName} is required` };
  }

  return { isValid: true };
};

// Min length validation
export const validateMinLength = (value: string, minLength: number, fieldName: string = 'This field'): ValidationResult => {
  if (!value || value.length < minLength) {
    return { isValid: false, error: `${fieldName} must be at least ${minLength} characters` };
  }

  return { isValid: true };
};

// Max length validation
export const validateMaxLength = (value: string, maxLength: number, fieldName: string = 'This field'): ValidationResult => {
  if (value && value.length > maxLength) {
    return { isValid: false, error: `${fieldName} must be no more than ${maxLength} characters` };
  }

  return { isValid: true };
};

// License plate validation (basic)
export const validateLicensePlate = (plate: string): ValidationResult => {
  if (!plate || plate.trim() === '') {
    return { isValid: false, error: 'License plate is required' };
  }

  const cleaned = plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (cleaned.length < 2 || cleaned.length > 10) {
    return { isValid: false, error: 'Please enter a valid license plate' };
  }

  return { isValid: true };
};

// Validate multiple fields at once
export interface FieldValidation {
  value: string;
  validators: ((value: string) => ValidationResult)[];
  fieldName: string;
}

export const validateForm = (fields: FieldValidation[]): { isValid: boolean; errors: Record<string, string> } => {
  const errors: Record<string, string> = {};
  let isValid = true;

  for (const field of fields) {
    for (const validator of field.validators) {
      const result = validator(field.value);
      if (!result.isValid) {
        errors[field.fieldName] = result.error || 'Invalid value';
        isValid = false;
        break;
      }
    }
  }

  return { isValid, errors };
};

// Rating validation
export const validateRating = (rating: number, min: number = 1, max: number = 5): ValidationResult => {
  if (rating < min || rating > max) {
    return { isValid: false, error: `Rating must be between ${min} and ${max}` };
  }

  return { isValid: true };
};
