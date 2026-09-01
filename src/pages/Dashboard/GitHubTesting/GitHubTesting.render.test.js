/**
 * Renders the real GitHub Testing components against REAL captured API
 * responses (src/pages/Dashboard/GitHubTesting/__fixtures__/), so what the
 * user actually sees on screen is asserted rather than inferred from the
 * database.
 *
 * The fixtures come from run 17269ca2 against
 * mnrtechnologies/MNR_AI_Tester-AI_Backend-Mobile_Testing, captured straight
 * off the live API with `curl`.
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import BusinessLogicTab from './components/BusinessLogicTab';
import ResultsTab from './components/ResultsTab';

import analyses from './__fixtures__/analysis.json';
import resultsPayload from './__fixtures__/results.json';
import tests from './__fixtures__/tests.json';

describe('BusinessLogicTab against real run data', () => {
  test('reports the true total number of contradictions, not 0', () => {
    render(<BusinessLogicTab analyses={analyses} loading={false} running={false} />);

    const expected = analyses.reduce(
      (n, a) => n + (a.spec?.functions || []).reduce((m, f) => m + (f.contradictions?.length || 0), 0),
      0
    );
    expect(expected).toBe(10); // guards the fixture itself

    // The bug the user hit: banner said 0 while the file rows said 6 and 4.
    expect(
      screen.getByText(/10 places where the code contradicts its own documentation/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/^0 places/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/No contradictions found/i)).not.toBeInTheDocument();
  });

  test('per-file badges agree with the banner', () => {
    render(<BusinessLogicTab analyses={analyses} loading={false} running={false} />);
    expect(screen.getByText(/6 contradictions/i)).toBeInTheDocument();
    expect(screen.getByText(/4 contradictions/i)).toBeInTheDocument();
  });
});

describe('ResultsTab against real run data', () => {
  const props = {
    data: resultsPayload,
    analyses,
    tests,
    loading: false,
    running: false,
    stage: 'completed',
  };

  test('a setup-only failure is NOT described as generated tests crashing', () => {
    render(<ResultsTab {...props} />);

    // Every result in this fixture is a synthetic setup placeholder.
    expect(resultsPayload.results.every((r) => r.category === 'setup')).toBe(true);

    expect(screen.getByText(/The test run could not start/i)).toBeInTheDocument();
    expect(screen.queryByText(/generated tests crashed/i)).not.toBeInTheDocument();
  });

  test('points the user at the contradictions that were still found', () => {
    render(<ResultsTab {...props} />);
    expect(screen.getByText(/analysis still found/i)).toBeInTheDocument();
    expect(screen.getByText(/10 issues/i)).toBeInTheDocument();
  });

  test('does not show a misleading grid of zeros when nothing executed', () => {
    render(<ResultsTab {...props} />);
    expect(screen.queryByText('Code bugs')).not.toBeInTheDocument();
    expect(screen.queryByText('Passed')).not.toBeInTheDocument();
  });
});
