FROM python:3.12-slim

WORKDIR /workspace

RUN apt-get update && apt-get install -y \
    git \
    curl \
    bash \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /workspace/requirements.txt

RUN python -m pip install --upgrade pip \
    && if [ -f requirements.txt ]; then pip install -r requirements.txt; fi

COPY . /workspace

CMD ["bash"]
