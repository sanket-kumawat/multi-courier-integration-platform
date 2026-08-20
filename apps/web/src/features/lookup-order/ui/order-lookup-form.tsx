import { Button } from '@multi-courier-integration-platform/ui/components/button';
import {
  Field,
  FieldError,
  FieldLabel,
} from '@multi-courier-integration-platform/ui/components/field';
import { Input } from '@multi-courier-integration-platform/ui/components/input';
import { useNavigate } from '@tanstack/react-router';
import { type FormEvent, useId, useState } from 'react';

type OrderLookupFormProps = {
  /** Prefill when known (e.g. after create). */
  defaultOrderId?: string;
  className?: string;
  submitLabel?: string;
};

export function OrderLookupForm({
  defaultOrderId = '',
  className,
  submitLabel = 'Look up',
}: OrderLookupFormProps) {
  const navigate = useNavigate();
  const id = useId();
  const [orderId, setOrderId] = useState(defaultOrderId);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = orderId.trim();
    if (!trimmed) {
      setError('Enter a consumer order id');
      return;
    }
    setError(null);
    void navigate({
      to: '/orders/$orderId',
      params: { orderId: trimmed },
    });
  };

  return (
    <form
      className={className}
      onSubmit={onSubmit}
      noValidate
    >
      <div className='flex flex-col gap-3 sm:flex-row sm:items-end'>
        <Field
          className='min-w-0 flex-1'
          data-invalid={error ? true : undefined}
        >
          <FieldLabel htmlFor={id}>Order ID</FieldLabel>
          <Input
            id={id}
            value={orderId}
            placeholder='OMS-2026-000142'
            aria-invalid={error ? true : undefined}
            onChange={(event) => {
              setOrderId(event.target.value);
              if (error) {
                setError(null);
              }
            }}
          />
          <FieldError>{error}</FieldError>
        </Field>
        <Button
          type='submit'
          className='shrink-0'
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
