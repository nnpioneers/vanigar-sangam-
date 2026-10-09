DO $$
DECLARE
    new_member_id UUID;
    admin_id UUID := '00000000-0000-0000-0000-000000000000';
    i INTEGER;
BEGIN
    FOR i IN 1..60 LOOP
        INSERT INTO members (
            id, member_number, member_name, related_person_name, related_person_relationship, 
            shop_name, address, mobile_number, number_of_sheets, status, join_date, daily_collection_amount, shop_category
        ) VALUES (
            gen_random_uuid(),
            'MOCK' || LPAD(i::text, 3, '0'),
            'Mock Member ' || i,
            'Relative ' || i,
            'OTHER',
            'Shop ' || i,
            'Address ' || i,
            '99999999' || LPAD(i::text, 2, '0'),
            1,
            'ACTIVE',
            '2026-01-01',
            200.00,
            CASE WHEN i % 2 = 0 THEN 'Grocery' ELSE 'Hardware' END
        ) RETURNING id INTO new_member_id;

        IF i <= 30 THEN
            INSERT INTO loans (
                member_id, requested_amount_paise, approved_amount_paise, status, application_date,
                disbursement_date, recorded_by_admin_id, loan_type, repayment_frequency, scheduled_installment_amount_paise
            ) VALUES (
                new_member_id, 10000000, 10000000, 'ACTIVE', '2026-01-01',
                '2026-01-01', admin_id, 'DAILY_CHIT', 'DAILY', 200000
            );
        END IF;
    END LOOP;
END $$;
