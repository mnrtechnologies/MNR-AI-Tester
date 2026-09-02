/**
 * Uploading code must never require a GitHub account.
 *
 * The regression this guards: PANE.CONNECT was set on disconnect but had no
 * render branch, so the main area rendered nothing. The page looked broken
 * and the only escape was reconnecting GitHub — to upload a local file that
 * needs no GitHub at all.
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import GitHubTesting from './index';

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
  Toaster: () => null,
}));

// Every call answers as a user who has NEVER connected GitHub.
jest.mock('./api', () => ({
  CODE_API: 'http://test',
  getAuthHeader: () => ({}),
  apiUpload: jest.fn(),
  errorMessage: (b, f) => f,
  fmtDate: () => '',
  fmtRelative: () => '',
  fmtDuration: () => '',
  estimateTokens: (b) => b,
  apiFetch: jest.fn(),
}));

// CRA sets resetMocks:true, which strips a factory's implementation after the
// first test — the second test would then get `undefined` back from every
// call. The implementation is therefore reinstalled before each test.
const { apiFetch } = require('./api');
beforeEach(() => {
  apiFetch.mockImplementation((path) => {
    if (path === '/github/status') return Promise.resolve({ connected: false });
    if (path === '/repos') return Promise.resolve([]);
    if (path === '/runs') return Promise.resolve([]);
    return Promise.resolve({});
  });
});

// Stubbed rather than mocking react-router-dom: v7 is ESM-only and CRA's jest
// resolver cannot load it. The credit badge is not what this test is about.
jest.mock('./components/CreditBalanceBadge', () => () => null);

describe('with no GitHub account connected', () => {
  test('the upload option is still on screen', async () => {
    render(<GitHubTesting />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /choose folder/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /choose \.zip/i })).toBeInTheDocument();
  });

  test('the page is not blank — the new-run pane renders', async () => {
    render(<GitHubTesting />);
    await waitFor(() =>
      expect(screen.getByText(/start a new run/i)).toBeInTheDocument(),
    );
  });

  test('connecting GitHub is offered as an option, not a gate', async () => {
    render(<GitHubTesting />);
    // Upload must be present ALONGSIDE the connect option, never replaced by it.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /choose folder/i })).toBeInTheDocument(),
    );
  });
});
