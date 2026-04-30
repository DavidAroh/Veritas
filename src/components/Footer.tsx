export default function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid var(--border)',
      padding: '40px 32px',
      maxWidth: 1200, margin: '0 auto',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 22, height: 22,
            border: '1.5px solid var(--acid)',
            borderRadius: 5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ width: 7, height: 7, background: 'var(--acid)', borderRadius: '50%' }} />
          </div>
          <span style={{
            fontFamily: 'var(--display)',
            fontWeight: 800,
            fontSize: 13,
            color: 'var(--text)',
            letterSpacing: '-0.02em',
          }}>
            VERITAS<span style={{ color: 'var(--acid)' }}>.</span>
          </span>
        </div>

        <p style={{
          fontFamily: 'var(--mono)',
          fontSize: 11,
          color: 'var(--text3)',
          letterSpacing: '0.03em',
        }}>
          Powered by{' '}
          <a
            href="https://aistudio.google.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--acid)', textDecoration: 'none' }}
          >
            Google Gemini
          </a>
          {' '}— truth verification for the open web.
        </p>
      </div>
    </footer>
  )
}
