import { validate } from 'class-validator';
import { PublicTrackingRequestDto } from '../src/modules/public-tracking/dto/public-tracking-request.dto';

describe('PublicTrackingRequestDto (US-17 / RN-17)', () => {
  it('accepts license plate and national id strings', async () => {
    const dto = new PublicTrackingRequestDto();
    dto.licensePlate = '1234ABC';
    dto.nationalId = '1234567';

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('requires licensePlate', async () => {
    const dto = new PublicTrackingRequestDto();
    dto.nationalId = '1234567';

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'licensePlate')).toBe(true);
  });

  it('requires nationalId', async () => {
    const dto = new PublicTrackingRequestDto();
    dto.licensePlate = '1234ABC';

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'nationalId')).toBe(true);
  });

  it('rejects non-string values', async () => {
    const dto = new PublicTrackingRequestDto();
    Object.assign(dto, { licensePlate: 1234, nationalId: 987654 });

    const errors = await validate(dto);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'licensePlate' }),
        expect.objectContaining({ property: 'nationalId' }),
      ]),
    );
  });
});
