# Student Points

Webapp to register a grading **color** for students. This is scaffolding only.

The school doesn't use a numeric point system (they'd use Smartschool for that).
Students are graded on a four-color scale, worst → best:

`red` → `yellow` → `green` → `blue`

See `lib/ratings.ts` for the ordered list, labels, and `ratingRank()` for comparing.

## Stack

- React 19 + TypeScript
- Vite
- React Router (`createBrowserRouter`)

## Scripts

```bash
npm run dev      # start dev server
npm run build    # typecheck + production build
npm run preview  # preview production build
npm run lint     # oxlint
```

## Structure

```
src/
  main.tsx            # entry, mounts RouterProvider
  router.tsx          # route definitions
  components/
    Layout.tsx        # sidebar + topbar shell, renders <Outlet />
    RatingBadge.tsx   # colored pill for a Rating
  pages/
    Dashboard.tsx     # color distribution overview
    Students.tsx      # student list with current color
    StudentDetail.tsx # single student + color history
    NotFound.tsx
  lib/
    types.ts          # Rating, Student, RatingEntry
    ratings.ts        # RATINGS order, labels, ratingRank()
    mockData.ts       # placeholder data — replace with API/store
```

## Next steps

- Replace `lib/mockData.ts` with a real data source (API + fetch, or a state store).
- Add a form to assign a color (with a reason) to a student.
- Add auth if teachers need separate accounts.
