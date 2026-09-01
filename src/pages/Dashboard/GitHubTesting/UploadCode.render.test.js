/**
 * Renders the real UploadCode component in a DOM.
 *
 * The specific thing under test is `webkitdirectory`. React only forwards
 * unknown attributes to the DOM under particular rules, and if it strips this
 * one the folder button silently opens a FILE picker instead — the feature
 * would look present and do the wrong thing, with no error anywhere. That is
 * exactly the failure a render test catches and a unit test cannot.
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import UploadCode from './components/UploadCode';

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

// The component imports these; neither is exercised by rendering.
jest.mock('./api', () => ({ apiUpload: jest.fn() }));

describe('UploadCode', () => {
  test('offers a folder option, not only a zip', () => {
    render(<UploadCode onIndexed={() => {}} />);
    expect(screen.getByRole('button', { name: /choose folder/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /choose \.zip/i })).toBeInTheDocument();
  });

  test('the folder input actually carries webkitdirectory in the DOM', () => {
    const { container } = render(<UploadCode onIndexed={() => {}} />);
    const inputs = container.querySelectorAll('input[type="file"]');
    expect(inputs.length).toBe(2);

    const folderInput = container.querySelector('input[webkitdirectory]');
    // If this is null, React dropped the attribute and the button would open
    // a file picker — the whole folder feature would be a no-op.
    expect(folderInput).not.toBeNull();
    expect(folderInput).toHaveAttribute('multiple');
  });

  test('the zip input still restricts to archive types', () => {
    const { container } = render(<UploadCode onIndexed={() => {}} />);
    const zipInput = container.querySelector('input[accept]');
    expect(zipInput).not.toBeNull();
    expect(zipInput.getAttribute('accept')).toMatch(/\.zip/);
  });

  test('tells the user what is skipped, so a big project is not a surprise', () => {
    render(<UploadCode onIndexed={() => {}} />);
    expect(screen.getByText(/node_modules/)).toBeInTheDocument();
  });
});
