'use client'

import { useFormState } from 'react-dom'
import { verifyCommercialCode } from '../actions/auth'
import styles from './commercial.module.css'

const initialState = {
    error: '',
}

export default function CommercialLoginPage() {
    const [state, formAction] = useFormState(verifyCommercialCode, initialState)

    return (
        <div className={styles.loginContainer}>
            <form action={formAction} className={styles.loginForm}>
                <div className={styles.logoContainer}>
                    {/* Placeholder for logo if needed, or just text */}
                    <h1 className={styles.title}>Área de Comerciales</h1>
                </div>

                <div className={styles.formGroup}>
                    <label htmlFor="code" className={styles.label}>Código de comercial</label>
                    <input
                        type="text"
                        id="code"
                        name="code"
                        className={styles.input}
                        placeholder="Introduce tu código"
                        required
                        autoComplete="off"
                        autoFocus
                    />
                </div>

                {state?.error && <p className={styles.error}>{state.error}</p>}

                <button type="submit" className={styles.button}>Acceder</button>
            </form>
        </div>
    )
}
