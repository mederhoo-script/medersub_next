"""Basic Python class example for an interview."""


class Employee:
	"""A class is a blueprint; each employee is an instance of it."""

	company = "Example Inc."  # Shared class attribute

	def __init__(self, name: str, salary: int) -> None:
		self.name = name  # Instance attributes belong to one object
		self.salary = salary

	def raise_salary(self, percent: float) -> None:
		"""Change this employee's salary."""
		self.salary = int(self.salary * (1 + percent / 100))

	def __str__(self) -> str:
		return f"{self.name}: ${self.salary}"


if __name__ == "__main__":
	employee = Employee("Alex", 50_000)
	employee.raise_salary(10)
	print(employee)
