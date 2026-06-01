# Ghid: creează „seiful online" (Supabase) — pas cu pas

Durează ~5 minute. Tot ce ai de făcut e mai jos. La final îmi trimiți **2 valori**
și mă ocup eu de restul (conectare, login, sincronizare).

## 1. Cont gratuit
- Intră pe **https://supabase.com** → **Start your project** → te înregistrezi
  (cel mai simplu: „Continue with GitHub", contul tău de GitHub).

## 2. Proiect nou
- Apasă **New project**.
- Name: `ofertare` (sau orice nume).
- Database Password: pune o parolă și **notează-o** (o folosești rar).
- Region: **Central EU (Frankfurt)** (cel mai aproape).
- **Create new project** → așteaptă ~1 minut să se construiască.

## 3. Rulează „rețeta" (creează tabelele)
- În stânga: **SQL Editor** → **New query**.
- Deschide fișierul `supabase/schema.sql` din proiectul tău GitHub, copiază TOT conținutul.
- Lipește-l în SQL Editor → apasă **Run** (sau Ctrl/Cmd+Enter).
- Trebuie să apară „Success".

## 4. Trimite-mi 2 valori (sunt sigure de partajat)
În stânga: **Project Settings** (rotița ⚙) → **API**. Copiază:
- **Project URL** (ex: `https://abcdxyz.supabase.co`)
- **anon public** key (un text lung care începe cu `eyJ...`)

> Aceste două valori sunt făcute special ca să fie publice — securitatea reală e dată
> de parola contului tău + regulile pe care le-am pus (fiecare vede doar datele lui).
> **NU** trimite niciodată cheia „service_role" (aia e secretă).

Când mi le dai, conectez aplicația și facem login + sincronizare. 🚀
