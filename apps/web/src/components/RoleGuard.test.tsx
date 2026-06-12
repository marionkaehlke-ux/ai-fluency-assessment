import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { UserRole } from '@ai-fluency/shared';
import { RoleGuard } from './RoleGuard.js';

function renderAt(role: UserRole) {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route path="/" element={<div>home</div>} />
        <Route
          path="/protected"
          element={
            <RoleGuard min="ELT" role={role}>
              <div>secret</div>
            </RoleGuard>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RoleGuard', () => {
  it('renders children when the role meets the threshold', () => {
    renderAt('ELT');
    expect(screen.getByText('secret')).toBeInTheDocument();
  });

  it('renders children when the role exceeds the threshold', () => {
    renderAt('ADMIN_CALIBRATOR');
    expect(screen.getByText('secret')).toBeInTheDocument();
  });

  it('redirects home when the role is below the threshold', () => {
    renderAt('MANAGER');
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    expect(screen.getByText('home')).toBeInTheDocument();
  });
});
