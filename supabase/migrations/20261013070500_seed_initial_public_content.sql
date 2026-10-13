update public.site_resume_profile
set
  headline = 'IT Technician focused on support, systems administration, and practical automation',
  summary = 'I am an IT Technician based in Carbondale, Kansas, supporting Minecraft Education and maintaining an enterprise-style home lab for continued education and experimentation. My work centers on helping people with technology, administering systems, automating repeatable tasks, and building reliable environments that mirror real-world IT operations.',
  availability = null,
  location = 'Carbondale, Kansas, United States',
  resume_url = 'https://www.linkedin.com/in/calebkmasters/',
  enabled = true,
  updated_at = now()
where id = 'primary';

delete from public.site_resume_entries;

insert into public.site_resume_entries (
  position,
  role,
  organization,
  period,
  summary,
  technologies,
  enabled,
  updated_at
)
values
  (
    1,
    'IT Technician',
    'Microsoft',
    'Current',
    'Provides technical support with a focus on making technology approachable and dependable, including support connected to Minecraft Education.',
    'Technical Support, Troubleshooting, Microsoft 365, Intune, Windows',
    true,
    now()
  ),
  (
    2,
    'Systems Administrator and Automation Builder',
    'Independent Home Lab',
    'Ongoing',
    'Designs and maintains an enterprise-style lab with identity services, virtualization, containers, endpoint management, segmented networking, monitoring, and layered backups. Develops automation to streamline provisioning, maintenance, and recovery workflows.',
    'Windows Server, Active Directory, Proxmox, UnRAID, Docker, PowerShell, Bash, VEEAM, VLANs, Firewalls',
    true,
    now()
  );

update public.site_now
set
  headline = 'shortbits.net 1.0 is live',
  summary = 'The main release of my terminal-shaped internet presence is now online. Version 1.0 brings together my professional profile, projects, music, favorite games, public statistics, guestbook, virtual filesystem, Arcade, achievements, desktop windows, and an increasingly unreasonable collection of system failures.',
  building = 'Polishing the 1.0 release and expanding the site with new interactive Bits.',
  learning = 'Frontend systems, Supabase-backed content, accessibility, automation, and how many Easter eggs one website can safely contain.',
  playing = 'Minecraft, Portal, Portal 2, and Life is Strange.',
  reading = null,
  enabled = true,
  updated_at = now()
where id = 'primary';

delete from public.site_changelog;

insert into public.site_changelog (
  position,
  entry_date,
  title,
  summary,
  enabled,
  updated_at
)
values (
  1,
  date '2026-10-13',
  'shortbits.net 1.0',
  'Initial main release of the BitsofBitsofBits internet presence: responsive social links, Admin-managed public content, desktop windows, themes and accessibility controls, Spotify and Discord integrations, Guestbook, virtual filesystem, Arcade and leaderboards, privacy-friendly statistics, achievements, Easter eggs, and a full spectrum of questionable system failures.',
  true,
  now()
);
