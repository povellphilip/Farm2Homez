import { useLocation, useNavigate } from 'react-router-dom';
import { errorMessage } from '@/api/errors';
import { useCartMutations } from '@/api/queries/consumer';
import { useAuth } from '@/auth/AuthProvider';
import { useToast } from '@/components/ui/Toaster';

/** Add to basket for consumers; sends visitors to sign in and explains why other roles cannot buy. */
export function useAddToCart() {
  const { user } = useAuth();
  const { add } = useCartMutations();
  const navigate = useNavigate();
  const location = useLocation();
  const notify = useToast();

  function addToCart(productSlug: string, productName: string, quantity: number) {
    if (!user) {
      navigate(`/consumer/login?next=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    if (user.role !== 'CONSUMER') {
      notify('Only shopper accounts can place orders. Sign in with a consumer account to buy.', 'error');
      return;
    }
    add.mutate(
      { product_slug: productSlug, quantity },
      {
        onSuccess: () => notify(`${productName} added to your basket.`),
        onError: (error) => notify(errorMessage(error), 'error'),
      },
    );
  }

  return { addToCart, pending: add.isPending, pendingSlug: add.isPending ? add.variables?.product_slug : undefined };
}
