import {
  Field,
  FieldLabel,
} from '@multi-courier-integration-platform/ui/components/field';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@multi-courier-integration-platform/ui/components/select';
import { Skeleton } from '@multi-courier-integration-platform/ui/components/skeleton';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useRef } from 'react';

import { orpc } from '@/shared/api';
import { toastApiError } from '@/shared/lib';

type CourierSelectProps = {
  value: string | null;
  onValueChange: (value: string | null) => void;
  id?: string;
  disabled?: boolean;
  label?: string;
  className?: string;
};

export function CourierSelect({
  value,
  onValueChange,
  id: idProp,
  disabled,
  label = 'Courier partner',
  className,
}: CourierSelectProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const toastedError = useRef<unknown>(null);

  const couriersQuery = useQuery({
    ...orpc.listCouriers.queryOptions(),
    meta: { skipGlobalErrorToast: true },
  });

  useEffect(() => {
    if (
      !couriersQuery.isError ||
      couriersQuery.error === toastedError.current
    ) {
      return;
    }
    toastedError.current = couriersQuery.error;
    toastApiError(couriersQuery.error);
  }, [couriersQuery.error, couriersQuery.isError]);

  const couriers = couriersQuery.data?.couriers ?? [];
  const isLoading = couriersQuery.isPending;

  return (
    <Field
      className={className}
      data-disabled={disabled || isLoading ? true : undefined}
    >
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {isLoading ? (
        <Skeleton className='h-8 w-full max-w-xs' />
      ) : (
        <Select
          value={value}
          onValueChange={onValueChange}
          disabled={disabled || couriers.length === 0}
        >
          <SelectTrigger
            id={id}
            className='w-full max-w-xs'
          >
            <SelectValue placeholder='Select a courier' />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {couriers.map((courier) => (
                <SelectItem
                  key={courier}
                  value={courier}
                >
                  {courier}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      )}
    </Field>
  );
}
