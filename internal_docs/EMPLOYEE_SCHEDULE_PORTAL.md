# Employee Schedule Portal

## Authorization model

Manager and Employee access are independent capabilities of one Supabase Auth identity.

```text
Manager application route
→ requires business_membership

/my-schedule
→ requires enabled employee_access linked to an active Employee
```

The employee-facing client never supplies an Employee identity. It calls:

```text
get_my_schedule(year, month)
```

The database derives the Employee from `auth.uid()` and returns only the business name,
employee display identity, selected period, and that Employee's shifts. Employees retain
no direct access to manager-facing canonical tables.

Saved canonical shifts are immediately visible in the portal for this MVP. This is not a
permanent publish-model decision.

## Access lifecycle

- An Employee email alone grants no portal access.
- A manager explicitly enables access from Team.
- The trusted `enable-employee-access` Edge Function authorizes the manager, obtains the
  Employee email from the manager's business, reuses a matching verified Auth identity or
  sends an invitation, and records the binding.
- While access is enabled, the Employee email is read-only.
- To change it, disable access, edit and save the email, then enable access again.
- Making an Employee inactive automatically disables access.
- Reactivating an Employee does not automatically restore access.

## Required deployment configuration

The Edge Function requires:

```text
EMPLOYEE_PORTAL_REDIRECT_URL=https://<deployment>/pricepocket_crew/my-schedule
```

Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` to the deployed function. The service-role key must never be
placed in Vite/browser configuration.

The hosting platform must rewrite the real route
`/pricepocket_crew/my-schedule` to the Vite `index.html`, while preserving the URL, so a
direct visit and an Auth callback both start the employee portal surface.

Add the deployed portal URL to Supabase Auth's permitted redirect URLs.

## Local end-to-end verification

1. Start Docker Desktop, local Supabase, and the Vite development server.
2. Serve the trusted function with its local environment:

   ```bash
   npx supabase functions serve enable-employee-access \
     --env-file supabase/functions/.env.local
   ```

3. Sign into the manager application.
4. Create and save an active Employee with a unique email.
5. Open Team and select **Enable access**. A new identity sends one invitation; an existing
   verified identity is reused.
6. Create a shift for the Employee in Planner and save it.
7. Open Mailpit at `http://127.0.0.1:54324`, open the invitation, and follow its link in an
   independent browser/session.
8. Confirm `/pricepocket_crew/my-schedule` shows the Employee name and canonical shift.
9. Navigate between months and verify the empty state where appropriate.
10. Attempt to open the manager root with the employee-only session; it must return to
    `/my-schedule` rather than opening the manager application.
11. Disable access from Team and try another portal month request; the portal must show
    that access is unavailable.

For local setup, copy `supabase/functions/.env.example` to the ignored
`supabase/functions/.env.local`. Never commit service-role credentials or real test tokens.
