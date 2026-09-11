import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RejectAdditionalFindingDto } from '../src/modules/work-orders/dto/reject-additional-finding.dto';

describe('RejectAdditionalFindingDto (US-21 / BE-T21.2)', () => {
  it('accepts a valid rejection reason', async () => {
    const instance = plainToInstance(RejectAdditionalFindingDto, {
      reason: 'El cliente prefiere no reparar el daño adicional',
    });

    const errors = await validate(instance);

    expect(errors).toHaveLength(0);
  });

  it('rejects a blank reason', async () => {
    const instance = plainToInstance(RejectAdditionalFindingDto, {
      reason: '   ',
    });

    const errors = await validate(instance);

    expect(errors.map((error) => error.property)).toContain('reason');
  });

  it('rejects a reason shorter than 3 characters', async () => {
    const instance = plainToInstance(RejectAdditionalFindingDto, {
      reason: 'ab',
    });

    const errors = await validate(instance);

    expect(errors.map((error) => error.property)).toContain('reason');
  });
});