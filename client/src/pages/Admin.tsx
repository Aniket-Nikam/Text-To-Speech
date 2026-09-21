import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { ErrorMessage } from '../components/Buttons';
type Analytics = {
  totalUsers: number;
  totalGenerations: number;
  totalCharacters: number;
  generationsToday: number;
  languages: { name: string; count: number }[];
  voices: { name: string; count: number }[];
  daily: { day: string; count: number }[];
  recent: { language: string; voice: string; character_count: number; created_at: string }[];
};
export default function Admin() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api<{ analytics: Analytics }>('/admin/analytics')
      .then((r) => {
        if (active) setData(r.analytics);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ADMINISTRATION</div>
          <h1>Usage overview.</h1>
          <p>Successful signed-in generations recorded by the application. All dates use UTC.</p>
        </div>
        <button className="primary" onClick={() => setRevision((n) => n + 1)} disabled={loading}>
          Refresh
        </button>
      </div>
      <ErrorMessage message={error} />
      {loading ? (
        <p role="status">Loading analytics…</p>
      ) : (
        data && (
          <>
            <div className="stats-grid">
              {[
                ['Users', data.totalUsers],
                ['Generations', data.totalGenerations],
                ['Characters', data.totalCharacters],
                ['Generations today', data.generationsToday],
              ].map(([name, value]) => (
                <div className="stat" key={name}>
                  <span>{name}</span>
                  <strong>{value.toLocaleString()}</strong>
                </div>
              ))}
            </div>
            <div className="analytics-grid">
              {[
                ['Languages', data.languages],
                ['Voices', data.voices],
              ].map(([title, rows]) => (
                <section className="panel analytics-panel" key={title as string}>
                  <h2>{title as string}</h2>
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Generations</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(rows as { name: string; count: number }[]).map((row) => (
                        <tr key={row.name}>
                          <td>{row.name}</td>
                          <td>{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!(rows as unknown[]).length && <p>No recorded usage yet.</p>}
                </section>
              ))}
              <section className="panel analytics-panel">
                <h2>Daily usage · last 30 days</h2>
                <table>
                  <thead>
                    <tr>
                      <th>UTC date</th>
                      <th>Generations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.daily.map((row) => (
                      <tr key={row.day}>
                        <td>{row.day}</td>
                        <td>{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.daily.length && <p>No recorded usage yet.</p>}
              </section>
              <section className="panel analytics-panel">
                <h2>Recent activity</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Voice</th>
                      <th>Characters</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.map((row, i) => (
                      <tr key={i}>
                        <td>
                          {row.voice}
                          <small>
                            {new Date(row.created_at).toISOString().replace('T', ' ').slice(0, 16)}{' '}
                            UTC
                          </small>
                        </td>
                        <td>{row.character_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.recent.length && <p>No recorded usage yet.</p>}
              </section>
            </div>
          </>
        )
      )}
    </>
  );
}
