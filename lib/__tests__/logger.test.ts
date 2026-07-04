import logger, { log, warn, error } from '@/lib/logger';

declare const global: { __DEV__: boolean } & typeof globalThis;

describe('logger dev gating', () => {
  const originalDev = global.__DEV__;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    global.__DEV__ = originalDev;
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe('in development (__DEV__ = true)', () => {
    beforeEach(() => {
      global.__DEV__ = true;
    });

    it('log passes through to console.log', () => {
      log('hello', 42);
      expect(logSpy).toHaveBeenCalledWith('hello', 42);
    });

    it('warn passes through to console.warn', () => {
      warn('careful');
      expect(warnSpy).toHaveBeenCalledWith('careful');
    });

    it('error passes through to console.error', () => {
      error('boom');
      expect(errorSpy).toHaveBeenCalledWith('boom');
    });
  });

  describe('in production (__DEV__ = false)', () => {
    beforeEach(() => {
      global.__DEV__ = false;
    });

    it('log is a no-op', () => {
      log('secret token', { phone: '+998901234567' });
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('warn is a no-op', () => {
      warn('debug detail');
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('error still passes through (crash triage)', () => {
      error('fatal thing');
      expect(errorSpy).toHaveBeenCalledWith('fatal thing');
    });
  });

  it('default export exposes the same functions', () => {
    expect(logger.log).toBe(log);
    expect(logger.warn).toBe(warn);
    expect(logger.error).toBe(error);
  });
});
