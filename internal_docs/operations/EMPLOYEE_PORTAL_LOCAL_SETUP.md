# Employee Portal Local Setup and Verification

## Required configuration

The trusted access-provisioning function requires:

```text
EMPLOYEE_PORTAL_REDIRECT_URL=http://127.0.0.1:5173/pricepocket_crew/my-schedule
```

Copy `supabase/functions/.env.example` to the ignored
`supabase/functions/.env.local`. Never commit service-role credentials or place them in Vite
browser configuration.

For deployment, add the portal URL to Supabase Auth redirect URLs and configure the host to rewrite
`/pricepocket_crew/my-schedule` to Vite's `index.html` while preserving the URL.

## Local verification

1. Start Docker Desktop, local Supabase, and the Vite development server.
2. Serve `enable-employee-access` using `supabase/functions/.env.local`.
3. Sign into the manager application.
4. Create an active Employee with a unique email and enable portal access.
5. Create and save a Shift for that Employee.
6. Open Mailpit at `http://127.0.0.1:54324`, then open the invitation in an independent session.
7. Confirm `/pricepocket_crew/my-schedule` displays only that Employee's canonical shifts.
8. Submit a Time-Off Request; confirm Pending in the portal, then approve or decline in Team.
9. For approval, confirm canonical Vacation appears and the portal status updates after refetch.
10. Submit a Sick Report; confirm it is immediately treated as canonical absence in Planner.
11. Acknowledge it in Team and confirm the Employee sees Acknowledged after refetch.
12. Disable portal access and confirm the next portal operation shows access unavailable.
