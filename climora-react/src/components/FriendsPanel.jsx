
/**
 * CLIMORA — Nearby Friends
 * Status: UPCOMING
 *
 * Friends feature is temporarily unavailable.
 * No AWS Friends API requests.
 * No geolocation requests.
 * No invite or sharing controls.
 *
 * Existing backend remains unchanged.
 */

const styles = {
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '7px 14px',
    borderRadius: '999px',
    background: 'rgba(99, 102, 241, 0.12)',
    color: '#818cf8',
    border: '1px solid rgba(129, 140, 248, 0.28)',
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap'
  },

  content: {
    marginTop: '20px',
    padding: '30px 20px',
    borderRadius: '20px',
    background:
      'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(16,185,129,0.06))',
    border: '1px solid rgba(129,140,248,0.16)',
    textAlign: 'center'
  },

  icon: {
    width: '68px',
    height: '68px',
    margin: '0 auto 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '22px',
    background: 'rgba(99,102,241,0.12)',
    fontSize: '32px'
  },

  title: {
    fontSize: '25px',
    fontWeight: 800,
    margin: '0 0 12px',
    color: 'inherit'
  },

  description: {
    fontSize: '14px',
    lineHeight: 1.8,
    opacity: 0.75,
    maxWidth: '430px',
    margin: '0 auto'
  },

  footer: {
    marginTop: '22px',
    fontSize: '12px',
    opacity: 0.6,
    letterSpacing: '0.3px'
  }
};

export function FriendsPanel() {
  return (
    <article className="panel cx-tool-card cx-friends-card">

      <div className="cx-tool-heading">
        <span className="cx-tool-icon" aria-hidden="true">
          ♧
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>Nearby Friends</h3>
          <p>
            Stay connected with trusted friends
            around you.
          </p>
        </div>

        <span style={styles.badge}>
          UPCOMING
        </span>
      </div>

      <div style={styles.content}>

        <div style={styles.icon} aria-hidden="true">
          🧑‍🤝‍🧑
        </div>

        <h3 style={styles.title}>
          Coming Soon!
        </h3>

        <p style={styles.description}>
          We're working on something exciting!
          Soon, you'll be able to connect with
          trusted friends, send private invitations,
          and optionally share approximate locations
          for a limited time.
        </p>

        <p style={styles.footer}>
          ✨ A new way to explore together
          is on its way.
        </p>

      </div>

      <p className="cx-tool-disclaimer">
        Nearby Friends is currently under development.
        Invitations and location sharing are temporarily
        unavailable. This panel does not request your
        location or contact the Friends API.
      </p>

    </article>
  );
}
