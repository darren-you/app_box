import { useState, type FormEvent } from 'react';
import LightRays from '../components/LightRays';
import styles from './LoginPage.module.css';

const LOGIN_TOP_IMAGE = '/assets/icons/appbox_1024x1024.png';

interface LoginPageProps {
  onSubmit: (password: string) => Promise<void>;
}

export default function LoginPage({ onSubmit }: LoginPageProps): JSX.Element {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onSubmit(password);
    } catch (e) {
      const message = e instanceof Error ? e.message : '登录失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <LightRays
        raysOrigin="top-center"
        raysColor="#d9d9d9"
        raysSpeed={1}
        lightSpread={0.5}
        rayLength={3}
        followMouse
        mouseInfluence={0.1}
        noiseAmount={0}
        distortion={0}
        className={styles.lightRays}
        pulsating={false}
        fadeDistance={1}
        saturation={1}
      />
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.passwordBlock}>
          <img src={LOGIN_TOP_IMAGE} alt="AppBox" className={styles.loginImage} />
          <input
            id="password"
            type="password"
            className={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码"
            autoComplete="current-password"
            required
          />
        </div>

        <button className={styles.button} type="submit" disabled={loading} aria-label="登录">
          {loading ? '...' : 'GO'}
        </button>

        {error && <p className={styles.error}>{error}</p>}
      </form>
    </main>
  );
}
