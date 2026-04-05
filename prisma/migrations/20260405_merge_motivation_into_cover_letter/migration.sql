-- Merge motivation_letter into cover_letter
UPDATE application_letters
SET letter_type = 'cover_letter'
WHERE letter_type = 'motivation_letter';
