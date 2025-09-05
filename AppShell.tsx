import type { ReactNode, CSSProperties } from 'react';

interface Props {
  title: string;
  children: ReactNode;
}

export default function AppShell({ title, children }: Props) {
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button type="button" style={styles.menu}>
          ☰
        </button>
        <h1 style={styles.title}>{title}</h1>
      </header>
      <main style={styles.content}>{children}</main>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: '#fff',
  },
  header: {
    height: 56,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    borderBottom: '1px solid #e5e7eb',
  },
  menu: {
    fontSize: 18,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 600,
  },
  content: {
    flex: 1,
    padding: 16,
  },
};
