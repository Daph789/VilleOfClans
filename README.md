# VilleOfClans

Premier socle de la web-app `VilleOfClans`, centré sur l'onboarding:

- inscription / connexion
- choix obligatoire d'un clan parmi 10 quartiers de Lille
- intégration Supabase prête à brancher

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- Supabase

## Lancer le projet

1. Installer les dépendances avec `npm install`
2. Copier `.env.example` vers `.env.local`
3. Renseigner `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Lancer `npm run dev`

## Étape suivante

Exécuter le SQL présent dans `supabase/schema.sql` pour créer:

- `profiles`
- `runs`
- `districts`

Puis brancher le dashboard et le leaderboard.
