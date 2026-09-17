import { useAuth } from '../lib/auth-context';

export function useEntitlements() {
  const { plan, features, limits } = useAuth();
  return {
    plan,
    can: (feature: string) => features.includes(feature),
    limits,
  };
}