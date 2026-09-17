import { useNavigate } from 'react-router-dom';

type Props = {
  open: boolean;
  feature?: string;
  onClose: () => void;
};

export function UpgradeModal({ open, feature, onClose }: Props) {
  const navigate = useNavigate();
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Funzionalità non disponibile nel tuo piano</h2>
        <p>
          {feature
            ? `La funzionalità "${feature}" richiede un piano superiore.`
            : 'Questa funzionalità richiede un piano superiore.'}
        </p>
        <div className="modal-actions">
          <button onClick={onClose}>Annulla</button>
          <button className="primary" onClick={() => { onClose(); navigate('/pricing'); }}>
            Vedi i piani
          </button>
        </div>
      </div>
    </div>
  );
}